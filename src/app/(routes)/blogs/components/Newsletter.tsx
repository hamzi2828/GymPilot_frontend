"use client";

import React, { useState } from "react";
import { newsletterService } from "../../blogs-detail/services/newsletterService";

const Newsletter: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Subscribes for real: the gym's newsletter list is what campaigns are sent
  // to, so a form that only pretended to subscribe quietly lost every reader
  // who filled it in.
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || isLoading) return;
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-20 gym-blog-custom-bg-darker text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="gym-blog-glass-effect rounded-2xl p-8 lg:p-12">
          <h2 className="font-montserrat font-bold text-3xl lg:text-4xl mb-4">
            Subscribe to our newsletter
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            News and updates from us, by email.
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={isLoading}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-gym-blog-custom-text-green focus:ring-2 focus:ring-gym-blog-custom-text-green/20"
              required
            />
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="gym-blog-custom-gradient-green text-black font-bold px-6 py-3 rounded-lg hover:scale-105 transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? "Subscribing..." : "Subscribe Now"}
            </button>
          </form>
          {notice && (
            <p
              role="status"
              aria-live="polite"
              className={`max-w-md mx-auto mt-4 text-sm p-3 rounded-lg border ${
                notice.tone === "ok"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-red-500/15 text-red-300 border-red-500/30"
              }`}
            >
              {notice.text}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-4">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
