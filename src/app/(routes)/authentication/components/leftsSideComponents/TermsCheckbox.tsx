import React, { useId } from 'react';
import Link from 'next/link';
import { FieldError, errorProps } from './FieldError';
import s from '../../auth.module.css';

interface TermsCheckboxProps {
  isSignUp: boolean;
  acceptTerms: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  termsError?: string | null;
}

export const TermsCheckbox: React.FC<TermsCheckboxProps> = ({ isSignUp, acceptTerms, handleInputChange, termsError }) => {
  const id = useId();
  if (!isSignUp) return null;
  const errId = `${id}-err`;
  return (
    <div className={s.terms}>
      <div className={s.termsRow}>
        <input
          id={id}
          name="acceptTerms"
          type="checkbox"
          checked={acceptTerms}
          onChange={handleInputChange}
          className={s.checkbox}
          {...errorProps(errId, termsError)}
        />
        <label htmlFor={id}>
          I agree to the{' '}
          <Link href="/terms" className={s.link}>
            Terms and Conditions
          </Link>{' '}
          and{' '}
          <Link href="/privacy-policy" className={s.link}>
            Privacy Policy
          </Link>
        </label>
      </div>
      <FieldError id={errId}>{termsError}</FieldError>
    </div>
  );
};
