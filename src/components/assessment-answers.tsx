import { answerText, type Answers, type Definition } from "@/modules/assessments/answers";

// Read-only answers, by section. Shared by the client (after submitting) and staff review.
export function AssessmentAnswers({ def, answers }: { def: Definition; answers: Answers }) {
  return (
    <div className="doc">
      {def.sections.map((s, i) => (
        <section key={s.id}>
          <h2>Section {i + 1} — {s.title}</h2>
          <dl className="answers">
            {s.questions.map((q) => {
              const text = answerText(q, answers);
              return (
                <div key={q.id}>
                  <dt>{q.id} {q.label}</dt>
                  <dd className={text ? undefined : "muted"}>{text ?? "Not answered"}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
