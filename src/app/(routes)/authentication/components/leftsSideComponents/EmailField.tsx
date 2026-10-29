import React, { useId } from 'react';
import type { FormData, Errors } from './types';
import { FieldError, errorProps } from './FieldError';
import s from '../../auth.module.css';

interface EmailFieldProps {
  formData: FormData;
  errors?: Errors;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /**
   * Signing in: the box also takes a username, which is how members without
   * an email address sign in. Sign-up and "forgot password" need an address.
   */
  allowUsername?: boolean;
}

export const EmailField: React.FC<EmailFieldProps> = ({ formData, errors, handleInputChange, allowUsername = false }) => {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{allowUsername ? 'Email or username' : 'Email address'}</label>
      <input
        id={id}
        name="email"
        type={allowUsername ? 'text' : 'email'}
        autoComplete={allowUsername ? 'username' : 'email'}
        autoCapitalize="none"
        spellCheck={false}
        required
        value={formData.email}
        onChange={handleInputChange}
        className={s.input}
        placeholder={allowUsername ? 'john@example.com or your username' : 'john@example.com'}
        {...errorProps(errId, errors?.email)}
      />
      <FieldError id={errId}>{errors?.email}</FieldError>
    </div>
  );
};
