import React from 'react';
import type { Mode } from './types';

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
    <div className="flex items-center justify-between">
      <label className="flex items-center space-x-3">
        <input
          name="rememberMe"
          type="checkbox"
          checked={rememberMe}
          onChange={handleInputChange}
          className="auth-check h-5 w-5 border-2 border-gray-300 rounded-lg bg-white"
        />
        <span className="text-sm text-gray-600 font-medium">Remember me</span>
      </label>
      <button
        type="button"
        onClick={() => updateMode('forgot')}
        className="auth-accent-text text-sm font-bold underline underline-offset-2"
      >
        Forgot password?
      </button>
    </div>
  );
};
