"use client";

import React, { useState } from "react";
import { newsletterService } from "../../blogs-detail/services/newsletterService";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";
import { Mail } from "lucide-react";
import Reveal from "@/components/site/Reveal";
import { surfaceClass } from "@/components/site/PageHero";

const Newsletter: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const { busy: isLoading, run } = useAsyncAction();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Subscribes for real: the gym's newsletter list is what campaigns are sent
  // to, so a form that only pretended to subscribe quietly lost every reader
  // who filled it in.
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    await run(async () => {
      setNotice(null);
      try {
        const res = await newsletterService.subscribe(value, "blog");
        setNotice({ tone: "ok", text: res.message || "You're subscribed. Thanks for joining!" });
        setEmail("");
      } catch (err) {
        setNotice({
          tone: "error",
          text: err instanceof Error ? err.message : "Could not subscribe right now. Please try again.",
        });
      }
    });
  };

  return (
    <section className={`${surfaceClass} px-4 py-12 sm:px-8 lg:px-20`}>
      <Reveal className="relative mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-[32px] border border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--surface)] px-6 py-12 text-center sm:px-12 lg:py-16">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[120%] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(ellipse, color-mix(in srgb, var(--accent) 25%, transparent), transparent 65%)" }}
            aria-hidden="true"
          />
          <Mail size={28} className="relative mx-auto text-[var(--accent)]" aria-hidden="true" />
          <h2 className="relative mt-4 font-['Montserrat'] text-3xl font-extrabold text-white lg:text-4xl">
            Subscribe to our newsletter
          </h2>
          <p className="relative mx-auto mt-3 max-w-2xl text-lg text-[var(--text-muted)]">
            News and updates from us, by email.
          </p>
          <form onSubmit={handleSubscribe} className="relative mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <label htmlFor="blog-newsletter-email" className="sr-only">Email address</label>
            <input
              id="blog-newsletter-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={isLoading}
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-white placeholder-white/40 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
              required
            />
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              aria-busy={isLoading || undefined}
              className="btn btn--primary"
            >
              <span className="inline-flex items-center gap-2">
                {isLoading && <Spinner />}
                {isLoading ? "Subscribing..." : "Subscribe Now"}
              </span>
            </button>
          </form>
          {notice && (
            <p
              role="status"
              aria-live="polite"
              className={`relative mx-auto mt-4 max-w-md rounded-xl border p-3 text-sm ${
                notice.tone === "ok"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-red-500/15 text-red-300 border-red-500/30"
              }`}
            >
              {notice.text}
            </p>
          )}
          <p className="relative mt-4 text-sm text-[var(--text-muted)]">No spam. Unsubscribe anytime.</p>
        </div>
      </Reveal>
    </section>
  );
};

export default Newsletter;
