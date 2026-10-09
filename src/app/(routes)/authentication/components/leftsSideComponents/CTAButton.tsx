import React from 'react';

interface CTAButtonProps {
  isLoading: boolean;
  isSignUp: boolean;
  isForgot: boolean;
  isReset?: boolean;
}

export const CTAButton: React.FC<CTAButtonProps> = ({
  isLoading,
  isSignUp,
  isForgot,
  isReset = false,
}) => {
  // The form's submit button: the form it sits in (LeftSide) does the
  // submitting, so a click and the Enter key take the same path.
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="auth-cta w-full py-4 px-6 rounded-2xl font-black text-lg transform hover:-translate-y-1 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isSignUp
            ? 'Creating Account...'
            : isForgot
            ? 'Sending Link...'
            : isReset
            ? 'Saving...'
            : 'Signing In...'}
        </>
      ) : (
        <>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSignUp ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            ) : isForgot ? (
              // Envelope: this step sends an email, it does not change anything.
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            ) : isReset ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v6m0-6a3 3 0 100-6 3 3 0 000 6zM4.5 12a7.5 7.5 0 1115 0" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            )}
          </svg>
          {isSignUp
            ? 'Create Account'
            : isForgot
            ? 'Send Reset Link'
            : isReset
            ? 'Set New Password'
            : 'Sign In'}
        </>
      )}
    </button>
  );
};
