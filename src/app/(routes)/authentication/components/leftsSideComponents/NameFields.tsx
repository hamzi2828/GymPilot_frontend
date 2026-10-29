import React, { useId } from 'react';
import type { FormData, Errors } from './types';
import { FieldError, errorProps } from './FieldError';
import s from '../../auth.module.css';

interface NameFieldsProps {
  isSignUp: boolean;
  formData: FormData;
  errors?: Errors;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const NameFields: React.FC<NameFieldsProps> = ({ isSignUp, formData, errors, handleInputChange }) => {
  const id = useId();
  if (!isSignUp) return null;
  const first = `${id}-first`;
  const last = `${id}-last`;
  return (
    <div className={s.row2}>
      <div className={s.field}>
        <label htmlFor={first} className={s.label}>First name</label>
        <input
          id={first}
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          value={formData.firstName}
          onChange={handleInputChange}
          className={s.input}
          placeholder="John"
          {...errorProps(`${first}-err`, errors?.firstName)}
        />
        <FieldError id={`${first}-err`}>{errors?.firstName}</FieldError>
      </div>
      <div className={s.field}>
        <label htmlFor={last} className={s.label}>Last name</label>
        <input
          id={last}
          name="lastName"
          type="text"
          autoComplete="family-name"
          required
          value={formData.lastName}
          onChange={handleInputChange}
          className={s.input}
          placeholder="Doe"
          {...errorProps(`${last}-err`, errors?.lastName)}
        />
        <FieldError id={`${last}-err`}>{errors?.lastName}</FieldError>
      </div>
    </div>
  );
};
