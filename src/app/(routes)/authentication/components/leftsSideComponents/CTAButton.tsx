import React from 'react';

interface CTAButtonProps {
  isLoading: boolean;
  isSignUp: boolean;
  isForgot: boolean;
  handleSubmit: () => void;
}

export const CTAButton: React.FC<CTAButtonProps> = ({ isLoading, isSignUp, isForgot, handleSubmit }) => {
  return (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={isLoading}
      className="w-full bg-gradient-to-r from-lime-400 via-lime-500 to-yellow-400 text-black py-4 px-6 rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl hover:from-lime-300 hover:via-lime-400 hover:to-yellow-300 transform hover:-translate-y-1 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-2 border-lime-300"
    >
      {isLoading ? (
        <>
          <svg className="animate-spin h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isSignUp ? 'Creating Account...' : isForgot ? 'Resetting...' : 'Signing In...'}
        </>
      ) : (
        <>
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSignUp ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            ) : isForgot ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v6m0-6a3 3 0 100-6 3 3 0 000 6zM4.5 12a7.5 7.5 0 1115 0" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            )}
          </svg>
          {isSignUp ? 'Create Account' : isForgot ? 'Reset Password' : 'Sign In'}
        </>
      )}
    </button>
  );
};
