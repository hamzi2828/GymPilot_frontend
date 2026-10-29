import React from 'react';
import s from '../../auth.module.css';

// The message under a box. The input points at it with aria-describedby.
export const FieldError: React.FC<{ id: string; children?: React.ReactNode }> = ({ id, children }) => {
  if (!children) return null;
  return (
    <p id={id} className={s.error}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 7.5v5M12 16h.01" />
      </svg>
      {children}
    </p>
  );
};

/** Props that tie an input to its error message. */
export const errorProps = (errorId: string, error?: string | null) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? errorId : undefined,
});

/** The eye button that shows or hides a password. */
export const EyeToggle: React.FC<{ shown: boolean; onToggle: () => void; controls: string }> = ({ shown, onToggle, controls }) => (
  <button
    type="button"
    onClick={onToggle}
    className={s.eye}
    aria-label={shown ? 'Hide password' : 'Show password'}
    aria-pressed={shown}
    aria-controls={controls}
  >
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {shown ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      )}
    </svg>
  </button>
);
