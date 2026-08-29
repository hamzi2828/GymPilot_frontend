// Route-level fallback while a segment loads.

export default function Loading() {
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200"
        style={{ borderTopColor: "var(--accent, #ff6b2c)" }}
        aria-hidden="true"
      />
    </div>
  );
}
