import React, { useId } from 'react';
import { FieldError, errorProps, EyeToggle } from './FieldError';
import s from '../../auth.module.css';

interface ConfirmPasswordFieldProps {
  label: string;
  placeholder: string;
  value: string;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (show: boolean) => void;
  error?: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ConfirmPasswordField: React.FC<ConfirmPasswordFieldProps> = ({
  label,
  placeholder,
  value,
  showConfirmPassword,
  setShowConfirmPassword,
  error,
  handleInputChange,
}) => {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      <div className={s.inputWrap}>
        <input
          id={id}
          name="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={value}
          onChange={handleInputChange}
          className={`${s.input} ${s.inputPw}`}
          placeholder={placeholder}
          {...errorProps(errId, error)}
        />
        <EyeToggle
          shown={showConfirmPassword}
          onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
          controls={id}
        />
      </div>
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
};
