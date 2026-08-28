import React, { useState } from 'react';
import { newsletterService } from '../services/newsletterService';

interface NewsletterProps {
  source?: string;
  title?: string;
  description?: string;
  className?: string;
}

const Newsletter: React.FC<NewsletterProps> = ({
  source = 'blog',
  title = "Never Miss a Workout",
  description = "Get the latest fitness tips, workout routines, and nutrition advice delivered straight to your inbox every week.",
  className = ""
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubscribed) {
    return (
      <div className={`gym-blog-custom-bg-darker rounded-2xl p-8 lg:p-12 text-center ${className}`}>
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-check text-white text-2xl"></i>
          </div>
          <h3 className="font-montserrat font-bold text-2xl lg:text-3xl text-white mb-4">
            Welcome to Our Community!
          </h3>
          <p className="text-gray-300 mb-6">
            Thank you for subscribing! You&apos;ll receive our latest fitness tips and workout routines in your inbox.
          </p>
          <button
            onClick={() => setIsSubscribed(false)}
            className="text-green-500 hover:text-green-400 transition-colors text-sm"
          >
            Subscribe another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`gym-blog-custom-bg-darker rounded-2xl p-8 lg:p-12 text-center ${className}`}>
      <h3 className="font-montserrat font-bold text-2xl lg:text-3xl text-white mb-4">
        {title}
      </h3>
      <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
        {description}
      </p>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="flex-1 px-4 py-3 gym-blog-custom-bg-dark text-white rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none transition-colors"
            disabled={isLoading}
            required
          />
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="gym-blog-custom-bg-green text-black px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black"></div>
                Subscribing...
              </span>
            ) : (
              'Subscribe'
            )}
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`text-sm mb-4 p-3 rounded-lg ${
            isSuccess
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {message}
          </div>
        )}

        <p className="text-gray-400 text-sm">
          Join 10,000+ fitness enthusiasts. Unsubscribe anytime.
        </p>
      </form>
    </div>
  );
};

export default Newsletter;