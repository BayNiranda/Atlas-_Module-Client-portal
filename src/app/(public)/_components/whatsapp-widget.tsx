"use client";

import { useState } from "react";
import { site, waLink } from "@/lib/site";
import { WhatsAppIcon } from "./icons";

export function WhatsAppWidget({ topics }: { topics: { label: string; message: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="wa-panel" role="dialog" aria-label="WhatsApp chat">
          <div className="wa-head">
            <i>
              {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
              <img src="/brand/mark.webp" alt="" width={26} />
            </i>
            <div>
              <b>Atlas Advisory</b>
              <span>Usually replies within working hours</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="wa-body">
            <div className="wa-bubble">
              ສະບາຍດີ 👋 Hello! What would you like to talk about? Choose a topic and WhatsApp will open with
              your message ready to send.
            </div>
            <div className="wa-topics">
              {topics.map((t) => (
                <a key={t.label} href={waLink(t.message)} target="_blank" rel="noopener noreferrer">
                  {t.label}
                  <span aria-hidden="true">›</span>
                </a>
              ))}
            </div>
          </div>
          <div className="wa-foot">
            This is a first discussion only. No commitment. WhatsApp: {site.whatsappDisplay}
          </div>
        </div>
      )}
      <button type="button" className="wa-btn" onClick={() => setOpen((o) => !o)} aria-label="Chat on WhatsApp" aria-expanded={open}>
        <WhatsAppIcon />
      </button>
    </>
  );
}
