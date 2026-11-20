"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { saveAssessment, type AssessmentResult } from "@/modules/assessments/actions";
import { progress, readAnswers, type Answers, type Definition, type Question } from "@/modules/assessments/answers";

type Props = { assessmentId: string; def: Definition; answers: Answers; prefill: Record<string, string> };

export function QuestionnaireForm({ assessmentId, def, answers, prefill }: Props) {
  const [state, run, pending] = useActionState<AssessmentResult, FormData>(saveAssessment, {});
  const [section, setSection] = useState(0);
  // Saved answer first; otherwise a sensible prefill (name, email, phone, company).
  const initial = (q: Question) => answers[q.id] ?? (q.prefill ? prefill[q.prefill] || undefined : undefined);
  const [prog, setProg] = useState(() =>
    progress(def, Object.fromEntries(def.sections.flatMap((s) => s.questions).flatMap((q) => (initial(q) ? [[q.id, initial(q)!]] : [])))));
  const formRef = useRef<HTMLFormElement>(null);
  const recount = () => formRef.current && setProg(progress(def, readAnswers(def, new FormData(formRef.current)).answers));

  // Submitting manually (not via the form's action prop) keeps what the client typed
  // on screen after saving, instead of React resetting the form.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    fd.set("intent", submitter?.value ?? "save");
    startTransition(() => run(fd));
  }

  const go = (i: number) => { setSection(i); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const sectionOf = (qid: string) => def.sections.findIndex((s) => s.questions.some((q) => q.id === qid));
  const pct = Math.round((prog.answered / prog.total) * 100);

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={recount} noValidate className="as-layout">
      <input type="hidden" name="assessment_id" value={assessmentId} />

      <nav className="as-nav" aria-label="Sections">
        <div className="muted" style={{ padding: "4px 10px" }}>{prog.answered} of {prog.total} answered</div>
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
          <span style={{ width: `${pct}%` }} />
        </div>
        {def.sections.map((s, i) => (
          <button type="button" key={s.id} onClick={() => go(i)} aria-current={i === section ? "step" : undefined}>
            {i + 1}. {s.title}
          </button>
        ))}
      </nav>

      <div className="panel">
        {state.error && (
          <div className="msg err" role="alert" style={{ marginTop: 0, marginBottom: 14 }}>
            {state.error}
            {(state.missing || state.problems) && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {(state.missing ?? Object.entries(state.problems ?? {}).map(([id, msg]) => ({ id, label: msg }))).map((m) => (
                  <li key={m.id}>
                    <button type="button" className="linklike" onClick={() => go(sectionOf(m.id))}>{m.id} {m.label}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {state.ok && state.message && <div className="msg ok" role="status" style={{ marginTop: 0, marginBottom: 14 }}>{state.message}</div>}

        {def.sections.map((s, i) => (
          // All sections stay in the form (hidden when not shown) so every answer is saved together.
          <section key={s.id} hidden={i !== section} aria-labelledby={`h-${s.id}`}>
            <h2 id={`h-${s.id}`}>Section {i + 1} — {s.title}</h2>
            {s.questions.map((q) => (
              <QuestionField key={q.id} q={q} value={initial(q)} other={answers[`${q.id}:other`] as string | undefined} problem={state.problems?.[q.id]} />
            ))}
          </section>
        ))}

        <div className="as-buttons">
          <button type="button" className="btn btn-o" disabled={section === 0} onClick={() => go(section - 1)}>Previous</button>
          <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" value="save" className="btn btn-o" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            {section < def.sections.length - 1 ? (
              <button type="button" className="btn btn-p" onClick={() => go(section + 1)}>Next section</button>
            ) : (
              <button type="submit" value="submit" className="btn btn-p" disabled={pending}>Submit to Atlas</button>
            )}
          </span>
        </div>
      </div>
    </form>
  );
}

function QuestionField({ q, value, other, problem }: { q: Question; value?: string | string[]; other?: string; problem?: string }) {
  const req = q.required ? <span className="req"> *</span> : null;
  const describedBy = [q.help && `help-${q.id}`, problem && `err-${q.id}`].filter(Boolean).join(" ") || undefined;
  const label = <>{q.id}&nbsp; {q.label}{req}</>;
  const extra = (
    <>
      {q.help && <div className="qh" id={`help-${q.id}`}>{q.help}</div>}
      {problem && <div className="err" id={`err-${q.id}`} style={{ color: "var(--red)" }}>{problem}</div>}
    </>
  );
  const otherBox = q.other && (
    <input name={`${q.id}:other`} defaultValue={other} maxLength={200} className="other-input"
      aria-label={`${q.id} please specify`} placeholder={`If "${q.other.replace(" (please specify)", "")}", please specify`} />
  );

  if (q.type === "radio" || q.type === "checkbox" || q.type === "scale") {
    const opts = q.type === "scale" ? Array.from({ length: (q.max ?? 5) - (q.min ?? 1) + 1 }, (_, i) => String((q.min ?? 1) + i)) : q.options!;
    const chosen = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <fieldset className="q" aria-describedby={describedBy}>
        <legend className="ql">{label}</legend>
        {q.type === "scale" && <div className="qh">{q.min} = {q.min_label} · {q.max} = {q.max_label}</div>}
        <div className={q.type === "scale" ? "yn" : "checks"}>
          {opts.map((o) => (
            <label key={o} className="chk">
              <input type={q.type === "checkbox" ? "checkbox" : "radio"} name={q.id} value={o} defaultChecked={chosen.includes(o)} />
              {o}
            </label>
          ))}
        </div>
        {otherBox}
        {extra}
      </fieldset>
    );
  }

  if (q.type === "consent") {
    return (
      <div className="q">
        <label className="chk plain" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" name={q.id} value="yes" defaultChecked={value === "yes"} aria-describedby={describedBy} />
          <span>{q.label}{req}</span>
        </label>
        {extra}
      </div>
    );
  }

  return (
    <div className="q">
      <label className="ql" htmlFor={`q-${q.id}`}>{label}</label>
      {q.type === "select" ? (
        <select id={`q-${q.id}`} name={q.id} defaultValue={(value as string) ?? ""} aria-describedby={describedBy}>
          <option value="">Select…</option>
          {q.options!.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : q.type === "long_text" ? (
        <textarea id={`q-${q.id}`} name={q.id} defaultValue={(value as string) ?? ""} maxLength={q.max} aria-describedby={describedBy} />
      ) : (
        <input id={`q-${q.id}`} name={q.id} defaultValue={(value as string) ?? ""} aria-describedby={describedBy}
          type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"} maxLength={q.type === "short_text" ? q.max : 254} />
      )}
      {q.type === "long_text" && q.max && <div className="qh">Up to {q.max} characters</div>}
      {otherBox}
      {extra}
    </div>
  );
}
