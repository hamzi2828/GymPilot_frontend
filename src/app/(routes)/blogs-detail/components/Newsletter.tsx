import React, { useState } from 'react';
import { newsletterService } from '../services/newsletterService';
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";

interface NewsletterProps {
  source?: string;
  title?: string;
  description?: string;
  className?: string;
  /** Narrow column: input and button stack. */
  stacked?: boolean;
}

const Newsletter: React.FC<NewsletterProps> = ({
  source = 'blog',
  title = "Subscribe to our newsletter",
  description = "News and updates from us, by email.",
  className = "",
  stacked = false
}) => {
  const [email, setEmail] = useState('');
  const { busy: isLoading, run } = useAsyncAction();
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => subscribe());
  };

  const subscribe = async () => {
    if (!email.trim()) {
      setMessage('Please enter your email address');
      setIsSuccess(false);
      return;
    }

    if (!newsletterService.validateEmail(email)) {
      setMessage('Please enter a valid email address');
      setIsSuccess(false);
      return;
    }

    try {
      setMessage('');

      const response = await newsletterService.subscribe(email, source);

      setIsSuccess(true);
      setIsSubscribed(true);
      setMessage(response.message);
      setEmail(''); // Clear email input

      // Hide success message after 5 seconds
      setTimeout(() => {
        setMessage('');
      }, 5000);

    } catch (error: unknown) {
      setIsSuccess(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe. Please try again.';
      setMessage(errorMessage);

      // Hide error message after 5 seconds
      setTimeout(() => {
        setMessage('');
      }, 5000);
    }
  };

  if (isSubscribed) {
    return (
      <div className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] ${stacked ? "p-6" : "p-8 lg:p-12"} text-center ${className}`}>
        <div className="mb-6">
          <div className="w-16 h-16 bg-[var(--accent)] text-[var(--on-accent)] rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check text-2xl" aria-hidden="true"></i>
          </div>
          <h3 className={`font-montserrat font-bold text-white mb-4 ${stacked ? "text-xl" : "text-2xl lg:text-3xl"}`}>
            You&apos;re subscribed
          </h3>
          <p className="text-gray-300 mb-6">
            Thank you for subscribing.
          </p>
          <button
            onClick={() => setIsSubscribed(false)}
            className="text-[var(--accent)] hover:opacity-80 transition-colors text-sm"
          >
            Subscribe another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] ${stacked ? "p-6" : "p-8 lg:p-12"} text-center ${className}`}>
      <h3 className={`font-montserrat font-bold text-white mb-4 ${stacked ? "text-xl" : "text-2xl lg:text-3xl"}`}>
        {title}
      </h3>
      <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
        {description}
      </p>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
        <div className={`flex flex-col gap-3 mb-4 ${stacked ? "" : "sm:flex-row"}`}>
          <label htmlFor="related-newsletter-email" className="sr-only">Email address</label>
          <input
            id="related-newsletter-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="min-w-0 flex-1 px-4 py-3 gym-blog-custom-bg-dark text-white rounded-full border border-white/15 focus:border-[var(--accent)] focus:outline-none transition-colors"
            disabled={isLoading}
            required
          />
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            aria-busy={isLoading || undefined}
            className="btn btn--primary"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Subscribing...
              </span>
            ) : (
              <span>Subscribe</span>
            )}
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`text-sm mb-4 p-3 rounded-lg ${
            isSuccess
              ? 'bg-brand-500/20 text-green-400 border border-brand-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {message}
          </div>
        )}

        <p className="text-gray-400 text-sm">
          No spam. Unsubscribe anytime.
        </p>
      </form>
    </div>
  );
};

export default Newsletter;