import React from 'react';
import type { Mode } from './types';

interface FooterToggleProps {
  isSignUp: boolean;
  isForgot: boolean;
  toggleAuthMode: () => void;
  updateMode: (mode: Mode) => void;
}

export const FooterToggle: React.FC<FooterToggleProps> = ({ isSignUp, isForgot, toggleAuthMode, updateMode }) => {
  return (
    <div className="text-center pt-4">
      <p className="text-sm text-gray-600 font-medium">
        {isForgot ? (
          <>
            Remembered your password?{' '}
            <button
              type="button"
              onClick={() => updateMode('signin')}
              className="auth-accent-text font-black transition-colors underline underline-offset-2"
            >
              Sign In
            </button>
          </>
        ) : isSignUp ? (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={toggleAuthMode}
              className="auth-accent-text font-black transition-colors underline underline-offset-2"
            >
              Sign In
            </button>
          </>
        ) : (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={toggleAuthMode}
              className="auth-accent-text font-black transition-colors underline underline-offset-2"
            >
              Sign Up
            </button>
          </>
        )}
      </p>
    </div>
  );
};
