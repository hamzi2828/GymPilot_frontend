import React from 'react';
import type { Mode } from './types';

interface SignInUtilitiesProps {
  isSignUp: boolean;
  isForgot: boolean;
  rememberMe: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateMode: (mode: Mode) => void;
}

export const SignInUtilities: React.FC<SignInUtilitiesProps> = ({
  isSignUp,
  isForgot,
  rememberMe,
  handleInputChange,
  updateMode,
}) => {
  if (isSignUp || isForgot) return null;
  return (
    <div className="flex items-center justify-between">
      <label className="flex items-center space-x-3">
        <input
          name="rememberMe"
          type="checkbox"
          checked={rememberMe}
          onChange={handleInputChange}
          className="h-5 w-5 text-lime-400 border-2 border-gray-300 rounded-lg focus:ring-lime-400 bg-white"
        />
        <span className="text-sm text-gray-600 font-medium">Remember me</span>
      </label>
      <button
        type="button"
        onClick={() => updateMode('forgot')}
        className="text-sm text-lime-600 hover:text-lime-700 font-bold underline decoration-lime-300 underline-offset-2"
      >
        Forgot password?
      </button>
    </div>
  );
};
