import React from 'react';
import type { Mode } from './types';
import s from '../../auth.module.css';

interface SignInUtilitiesProps {
  isSignUp: boolean;
  isForgot: boolean;
  isReset?: boolean;
  rememberMe: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateMode: (mode: Mode) => void;
}

export const SignInUtilities: React.FC<SignInUtilitiesProps> = ({
  isSignUp,
  isForgot,
  isReset = false,
  rememberMe,
  handleInputChange,
  updateMode,
}) => {
  if (isSignUp || isForgot || isReset) return null;
  return (
    <div className={s.utilRow}>
      <label className={s.check}>
        <input
          name="rememberMe"
          type="checkbox"
          checked={rememberMe}
          onChange={handleInputChange}
          className={s.checkbox}
        />
        <span>Remember me</span>
      </label>
      <button type="button" onClick={() => updateMode('forgot')} className={s.link}>
        Forgot password?
      </button>
    </div>
  );
};
