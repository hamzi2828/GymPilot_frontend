"use client";

// Small pieces the operations and content lists share: the Previous / Next
// pager the audit log and attendance screens draw inline, and an error line
// with a retry for a list that failed to load (rather than an empty state
// that reads as "nothing here yet").

/** Renders nothing when everything fits on one page. */
export function Pager({
  page,
  pages,
  total,
  onChange,
  disabled = false,
}: {
  page: number;
  pages: number;
  total?: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
      <span>
        Page {page} of {pages}
        {total !== undefined ? ` · ${total} in all` : ""}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** The page count from whatever pagination block an endpoint returns. */
export function pageCount(pagination?: { pages?: number; total?: number; limit?: number } | null): number {
  if (!pagination) return 1;
  if (pagination.pages && pagination.pages > 0) return pagination.pages;
  if (pagination.total && pagination.limit) return Math.max(1, Math.ceil(pagination.total / pagination.limit));
  return 1;
}

/** A shared error line with a way to try again, for lists that failed to load. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
      >
        Try again
      </button>
    </div>
  );
}
