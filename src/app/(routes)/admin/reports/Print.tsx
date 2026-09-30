"use client";

// Print / Save as PDF for the reports: the browser's own print, with a
// stylesheet that turns the admin page into an A4 report -- no sidebar, top
// bar or controls, a header naming the gym and the range, and tables that
// break between rows rather than through them.
//
// The stylesheet is rendered by the reports page itself, so it only exists
// while a report is on screen; nothing here reaches any other page's
// printing (the till's receipts have their own).
//
// Inside the report, mark with:
//   data-print-root    the page's outermost element (everything else in the
//                      admin shell is left off the sheet)
//   data-print-hide    controls: tabs, date pickers, buttons, downloads
//   data-print-only    shown on paper only (the header below)
//   data-print-keep    a block to keep on one page if it fits (a grid's
//                      cells already are)
//   data-print-cols    columns for a grid on paper ("2", "3" or "4")

import { useSiteSettings } from "@/components/ThemeProvider";

const PRINT_CSS = `
[data-print-only] { display: none; }

@media print {
  @page { size: A4 portrait; margin: 12mm 10mm; }

  html, body {
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
  }
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    box-shadow: none !important;
  }

  /* The admin shell is a full-height window whose main column scrolls; on
     paper it has to flow from sheet to sheet instead, or only the first
     screenful prints. */
  body div:has(main), body main {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  body main { padding: 0 !important; }
  body main > div { max-width: none !important; margin: 0 !important; }

  /* No sidebar, top bar, drawer scrim or banners -- only the report. */
  aside,
  body div:has(> main) > :not(main),
  body main > div > :not([data-print-root]):not(:has([data-print-root])) {
    display: none !important;
  }

  [data-print-hide] { display: none !important; }
  [data-print-only] { display: block !important; }

  [data-print-root] { font-size: 10pt; color: #171717; }
  [data-print-root] [class*="overflow-"],
  [data-print-root] [class*="max-h-"] {
    overflow: visible !important;
    max-height: none !important;
  }
  [data-print-root] .sticky { position: static !important; }

  [data-print-root] [data-print-cols="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  [data-print-root] [data-print-cols="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  [data-print-root] [data-print-cols="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  [data-print-root] [data-print-cols] { gap: 8px !important; }
  [data-print-root] [data-print-cols] > * { padding: 8px 10px !important; }

  [data-print-keep],
  [data-print-root] [data-print-cols] > * { break-inside: avoid; page-break-inside: avoid; }
  [data-print-root] h2, [data-print-root] h3 { break-after: avoid; page-break-after: avoid; }

  /* Tables: the heading row again at the top of every sheet, never a row
     cut in half, and the totals once, at the end -- not repeated per sheet. */
  [data-print-root] table { width: 100% !important; border-collapse: collapse; }
  [data-print-root] thead { display: table-header-group; }
  [data-print-root] tfoot { display: table-row-group; }
  [data-print-root] tr, [data-print-root] td, [data-print-root] th {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  [data-print-root] th, [data-print-root] td { padding: 3px 6px !important; }
}
`;

/** The print stylesheet; render it once on the page being printed. */
export function PrintStyles() {
  return <style>{PRINT_CSS}</style>;
}

const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export function rangeLabel(from: string, to: string) {
  return from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;
}

/** The top of the first sheet: whose report, which one, for when. */
export function PrintHeader({ title, from, to }: { title: string; from: string; to: string }) {
  const { siteName } = useSiteSettings();
  return (
    <div data-print-only className="mb-4 border-b border-neutral-300 pb-3">
      <p className="text-lg font-semibold text-neutral-900">{siteName}</p>
      <p className="text-sm text-neutral-800">
        {title} · {rangeLabel(from, to)}
      </p>
      <p className="text-xs text-neutral-500">Printed {new Date().toLocaleString()}</p>
    </div>
  );
}

/**
 * Opens the browser's print dialog, where "Save as PDF" is one of the
 * printers. The page title is what browsers offer as the PDF's file name, so
 * it names the report and the range while the dialog is open.
 */
export function printReport(fileTitle: string) {
  const previous = document.title;
  document.title = fileTitle;
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}
