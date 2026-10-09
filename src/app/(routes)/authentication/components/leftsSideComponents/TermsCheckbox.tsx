import React from 'react';
import Link from 'next/link';

interface TermsCheckboxProps {
  isSignUp: boolean;
  acceptTerms: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  termsError?: string | null;
}

export const TermsCheckbox: React.FC<TermsCheckboxProps> = ({ isSignUp, acceptTerms, handleInputChange, termsError }) => {
  if (!isSignUp) return null;
  return (
    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
      <div className="flex items-start space-x-3">
        <input
          name="acceptTerms"
          type="checkbox"
          checked={acceptTerms}
          onChange={handleInputChange}
          className="auth-check h-5 w-5 border-2 border-gray-300 rounded-lg mt-0.5 bg-white"
        />
        <label className="text-sm text-gray-600 font-medium leading-relaxed">
          I agree to the{' '}
          <Link
            href="/terms"
            className="auth-accent-text font-bold underline underline-offset-2"
          >
            Terms and Conditions
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy-policy"
            className="auth-accent-text font-bold underline underline-offset-2"
          >
            Privacy Policy
          </Link>
        </label>
      </div>
      {termsError && (
        <p className="text-sm text-red-600 mt-2">{termsError}</p>
      )}
    </div>
  );
};
