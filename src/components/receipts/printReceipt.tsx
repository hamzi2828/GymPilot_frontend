"use client";

// Prints one receipt and nothing else. window.print() prints the whole admin
// page -- sidebar, basket, sales list -- on A4; a till wants a strip of roll
// paper exactly as long as the receipt. So the receipt is rendered into a
// frame of its own, off screen, with a page sized to the roll: as wide as
// the paper and as tall as the receipt measures once its logo has loaded.
// Thermal printer drivers then print it as one piece and cut after it.

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { ThermalReceipt, type ThermalReceiptProps } from "./ThermalReceipt";

const FRAME_ID = "gp-receipt-print-frame";

// How long a slow logo may hold the print up before it goes without it.
const IMAGE_WAIT_MS = 3000;

let current: { frame: HTMLIFrameElement; root: Root } | null = null;

function cleanUp() {
  if (!current) return;
  const { frame, root } = current;
  current = null;
  try {
    root.unmount();
  } catch {
    // The frame may already be gone; there is nothing left to unmount.
  }
  frame.remove();
}

function absolute(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

function imagesLoaded(doc: Document): Promise<void> {
  const pending = Array.from(doc.images)
    .filter((img) => !img.complete)
    .map((img) => new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    }));
  if (!pending.length) return Promise.resolve();
  return Promise.race([Promise.all(pending).then(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_MS))]);
}

/**
 * Sends one receipt to the printer (the browser's print dialog), laid out for
 * the roll width in `props.settings.paperWidth`. Resolves once the dialog has
 * been opened. A second call while one is still open replaces it.
 */
export async function printReceipt(props: ThermalReceiptProps): Promise<void> {
  if (typeof window === "undefined") return;
  cleanUp();
  document.getElementById(FRAME_ID)?.remove();

  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.title = "Receipt";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // Laid out but out of sight. A display:none frame prints blank in Chrome,
  // and one with no width cannot be measured.
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "400px", height: "1000px", border: "0" });

  const loaded = new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  const title = `Receipt ${props.number || ""}`.trim().replace(/[<&>]/g, "");
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>html,body{margin:0;padding:0;background:#fff}</style></head><body><div id="root"></div></body></html>`;
  document.body.appendChild(frame);
  await loaded;

  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const mount = doc?.getElementById("root");
  if (!win || !doc || !mount) {
    frame.remove();
    throw new Error("Could not prepare the receipt for printing");
  }

  const root = createRoot(mount);
  current = { frame, root };
  const receipt = { ...props, branding: { ...props.branding, logoUrl: absolute(props.branding.logoUrl) } };
  flushSync(() => root.render(<ThermalReceipt {...receipt} />));
  await imagesLoaded(doc);

  // One page, the roll's width by the receipt's own length (plus a little,
  // so rounding never spills a last line onto a second page).
  const element = doc.querySelector(".gp-receipt");
  const heightMm = element ? Math.ceil((element.getBoundingClientRect().height * 25.4) / 96) + 2 : 200;
  const page = doc.createElement("style");
  page.textContent = `@page { size: ${props.settings.paperWidth} ${heightMm}mm; margin: 0; } html, body { width: ${props.settings.paperWidth}; }`;
  doc.head.appendChild(page);

  // The frame goes once printing is over. Chrome's print() only returns then;
  // other browsers return at once and say so with afterprint.
  win.addEventListener("afterprint", () => setTimeout(cleanUp, 0), { once: true });
  win.focus();
  win.print();
}

export default printReceipt;
