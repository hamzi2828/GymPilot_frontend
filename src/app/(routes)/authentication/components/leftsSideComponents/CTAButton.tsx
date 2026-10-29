import React from 'react';
import Spinner from '@/components/ui/Spinner';

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
      aria-busy={isLoading || undefined}
      className="btn btn--primary btn--lg btn--block"
    >
      {isLoading ? (
        <>
          <Spinner />
          <span>
            {isSignUp
              ? 'Creating Account...'
              : isForgot
              ? 'Sending Link...'
              : isReset
              ? 'Saving...'
              : 'Signing In...'}
          </span>
        </>
      ) : (
        <>
          <span>
            {isSignUp
              ? 'Create Account'
              : isForgot
              ? 'Send Reset Link'
              : isReset
              ? 'Set New Password'
              : 'Sign In'}
          </span>
          {/* Arrow nudges right on hover (shared .btn style). */}
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 12h14m-6-6l6 6-6 6" />
          </svg>
        </>
      )}
    </button>
  );
};
