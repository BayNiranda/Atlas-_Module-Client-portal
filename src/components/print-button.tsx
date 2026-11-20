"use client";

// Uses the browser's own print dialog, which also offers "Save as PDF".
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-o btn-sm" onClick={() => window.print()}>
      {label}
    </button>
  );
}
