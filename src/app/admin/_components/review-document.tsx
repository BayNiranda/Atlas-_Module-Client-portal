import { reviewDocument } from "@/modules/documents/actions";
import { ActionForm } from "@/components/action-form";

// Accept, or reject with a reason the client sees.
export function ReviewDocument({ id }: { id: string }) {
  return (
    <div className="review-actions">
      <ActionForm action={reviewDocument} submit="Accept" className="inline-status">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="accept" />
      </ActionForm>
      <details>
        <summary className="btn btn-o btn-sm">Reject…</summary>
        <ActionForm action={reviewDocument} submit="Reject">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <label htmlFor={`note-${id}`} className="muted">What is wrong? (the client sees this)</label>
          <textarea id={`note-${id}`} name="note" maxLength={2000} />
        </ActionForm>
      </details>
    </div>
  );
}
