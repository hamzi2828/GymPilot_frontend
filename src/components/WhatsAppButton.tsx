"use client";

// Floating "chat on WhatsApp" button, when the gym has set one up
// (Settings → Messaging → WhatsApp button on the website).

import { useSiteSettings } from "@/components/ThemeProvider";

export default function WhatsAppButton() {
  const { whatsappButton } = useSiteSettings();
  if (!whatsappButton || !whatsappButton.number) return null;

  const digits = whatsappButton.number.replace(/\D/g, "");
  if (!digits) return null;
  const href = `https://wa.me/${digits}${whatsappButton.message ? `?text=${encodeURIComponent(whatsappButton.message)}` : ""}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <i className="fab fa-whatsapp text-3xl" aria-hidden="true" />
    </a>
  );
}
