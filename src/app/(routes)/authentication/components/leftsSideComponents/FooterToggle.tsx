import React from 'react';
import type { Mode } from './types';
import s from '../../auth.module.css';

interface FooterToggleProps {
  isSignUp: boolean;
  isForgot: boolean;
  isReset?: boolean;
  toggleAuthMode: () => void;
  updateMode: (mode: Mode) => void;
}

export const FooterToggle: React.FC<FooterToggleProps> = ({
  isSignUp,
  isForgot,
  isReset = false,
  toggleAuthMode,
  updateMode,
}) => {
  return (
    <p className={s.footer}>
      {isForgot || isReset ? (
        <>
          Remembered your password?{' '}
          <button type="button" onClick={() => updateMode('signin')} className={s.link}>
            Sign In
          </button>
        </>
      ) : isSignUp ? (
        <>
          Already have an account?{' '}
          <button type="button" onClick={toggleAuthMode} className={s.link}>
            Sign In
          </button>
        </>
      ) : (
        <>
          Don&apos;t have an account?{' '}
          <button type="button" onClick={toggleAuthMode} className={s.link}>
            Sign Up
          </button>
        </>
      )}
    </p>
  );
};
