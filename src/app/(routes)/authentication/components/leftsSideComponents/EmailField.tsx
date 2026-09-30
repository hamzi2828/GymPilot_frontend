import React from 'react';
import type { FormData, Errors } from './types';

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
  return (
    <div>
      <label className="block text-sm font-bold text-gray-900 mb-2">{allowUsername ? 'Email or username' : 'Email Address'}</label>
      <input
        name="email"
        type={allowUsername ? 'text' : 'email'}
        autoComplete={allowUsername ? 'username' : 'email'}
        autoCapitalize="none"
        spellCheck={false}
        required
        value={formData.email}
        onChange={handleInputChange}
        className="w-full px-4 py-4 auth-field border-2 border-gray-200 rounded-2xl outline-none text-gray-900 font-medium placeholder-gray-400 bg-white/80 backdrop-blur-sm"
        placeholder={allowUsername ? 'john@example.com or your username' : 'john@example.com'}
      />
      {errors?.email && (
        <p className="text-sm text-red-600 mt-1">{errors.email}</p>
      )}
    </div>
  );
};
