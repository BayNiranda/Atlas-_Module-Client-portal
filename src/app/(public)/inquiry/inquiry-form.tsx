"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import Script from "next/script";
import { submitInquiry } from "@/modules/inquiries/actions";
import { COMPANY_SIZES, INDUSTRIES, type InquiryState } from "@/modules/inquiries/schema";

type Props = { services: { slug: string; name: string }[]; preselected: string | null };

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string }) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function InquiryForm({ services, preselected }: Props) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitInquiry, { status: "idle" });
  const tsBox = useRef<HTMLDivElement>(null);
  const tsId = useRef<string | null>(null);

  function renderTurnstile() {
    if (window.turnstile && tsBox.current && !tsId.current) {
      tsId.current = window.turnstile.render(tsBox.current, { sitekey: SITE_KEY });
    }
  }
  useEffect(() => {
    renderTurnstile();
    return () => {
      if (tsId.current) window.turnstile?.remove(tsId.current);
      tsId.current = null;
    };
  }, []);
  // A spam-check token works once; get a fresh one after each failed attempt.
  useEffect(() => {
    if (state.status === "error" && tsId.current) window.turnstile?.reset(tsId.current);
    if (state.status !== "idle") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state]);

  if (state.status === "success") {
    return (
      <div className="success" role="status">
        <h2>Thank you, {state.contactName}</h2>
        <p>Your inquiry has been received.</p>
        {state.reference && (
          <>
            <p>Your reference number:</p>
            <div className="ref">{state.reference}</div>
          </>
        )}
        <p style={{ color: "var(--ink3)" }}>Our team will contact you within two working days.</p>
        <p style={{ marginTop: 18 }}>
          <Link className="btn btn-o" href="/services">Back to services</Link>
        </p>
      </div>
    );
  }

  const err = state.status === "error" ? state.fieldErrors : {};
  const v = state.status === "error" ? state.values : {};
  const val = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const chosen = Array.isArray(v.services) ? v.services : preselected ? [preselected] : [];

  const field = (id: string, label: string, required: boolean, input: React.ReactNode, full = false) => (
    <div className={`field${full ? " full" : ""}`}>
      <label htmlFor={id}>
        {label} {required ? <span className="req">*</span> : <span className="opt">(optional)</span>}
      </label>
      {input}
      {err[id] && <div className="err" id={`err-${id}`}>{err[id]}</div>}
    </div>
  );
  const a11y = (id: string) => ({ id, name: id, "aria-invalid": !!err[id] || undefined, "aria-describedby": err[id] ? `err-${id}` : undefined });

  return (
    <form className="panel" action={action} noValidate>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={renderTurnstile} />
      {state.status === "error" && (
        <div className="note" role="alert" style={{ marginBottom: 16, borderColor: "#f0d3cc", background: "#fbefec", color: "var(--red)" }}>
          {state.message ?? "Please check the highlighted fields."}
        </div>
      )}
      <div className="form-grid">
        {field("company_name", "Company name", true, <input {...a11y("company_name")} defaultValue={val("company_name")} autoComplete="organization" />)}
        {field("contact_name", "Contact person's name", true, <input {...a11y("contact_name")} defaultValue={val("contact_name")} autoComplete="name" />)}
        {field("email", "Email address", true, <input {...a11y("email")} type="email" defaultValue={val("email")} autoComplete="email" />)}
        {field("phone", "Phone / WhatsApp", true, <input {...a11y("phone")} type="tel" placeholder="+856 20 …" defaultValue={val("phone")} autoComplete="tel" />)}
        {field("industry", "Industry", true,
          <select {...a11y("industry")} defaultValue={val("industry")}>
            <option value="">Select…</option>
            {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
          </select>)}
        {field("company_size", "Company size", false,
          <select {...a11y("company_size")} defaultValue={val("company_size")}>
            <option value="">Select…</option>
            {COMPANY_SIZES.map((s) => <option key={s}>{s}</option>)}
          </select>)}

        <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }} aria-describedby={err.services ? "err-services" : undefined}>
          <legend className="lbl" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink2)", marginBottom: 5 }}>
            Interested service <span className="req">*</span>
          </legend>
          <div className="checks">
            {services.map((s) => (
              <label className="chk" key={s.slug}>
                <input type="checkbox" name="services" value={s.slug} defaultChecked={chosen.includes(s.slug)} />
                {s.name}
              </label>
            ))}
          </div>
          {err.services && <div className="err" id="err-services">{err.services}</div>}
        </fieldset>

        {field("challenge", "Business challenges", true,
          <textarea {...a11y("challenge")} defaultValue={val("challenge")} placeholder="What is not working today, and what would you like to achieve?" />, true)}
        {field("preferred_date", "Preferred consultation date", false, <input {...a11y("preferred_date")} type="date" defaultValue={val("preferred_date")} />)}

        {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="field full">
          <label className="chk plain">
            <input type="checkbox" name="consent" aria-describedby={err.consent ? "err-consent" : undefined} />
            I agree that Atlas Advisory may contact me about this inquiry.
          </label>
          {err.consent && <div className="err" id="err-consent">{err.consent}</div>}
        </div>
        <div className="field full">
          <div ref={tsBox} />
        </div>
      </div>
      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <button className="btn btn-p" type="submit" disabled={pending}>{pending ? "Sending…" : "Submit inquiry"}</button>
        <Link className="btn btn-o" href="/services">Back to services</Link>
      </div>
    </form>
  );
}
