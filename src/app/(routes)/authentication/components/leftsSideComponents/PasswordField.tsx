import React, { useId } from 'react';
import { FieldError, errorProps, EyeToggle } from './FieldError';
import s from '../../auth.module.css';

interface PasswordFieldProps {
  label: string;
  name?: string;
  placeholder: string;
  value: string;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  error?: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** current-password when signing in, new-password when choosing one. */
  autoComplete?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  label,
  name = 'password',
  placeholder,
  value,
  showPassword,
  setShowPassword,
  error,
  handleInputChange,
  autoComplete,
}) => {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      <div className={s.inputWrap}>
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={handleInputChange}
          className={`${s.input} ${s.inputPw}`}
          placeholder={placeholder}
          {...errorProps(errId, error)}
        />
        <EyeToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} controls={id} />
      </div>
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
};
