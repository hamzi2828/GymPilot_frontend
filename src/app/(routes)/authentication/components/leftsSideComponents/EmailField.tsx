import React from 'react';
import type { FormData, Errors } from './types';

interface EmailFieldProps {
  formData: FormData;
  errors?: Errors;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const EmailField: React.FC<EmailFieldProps> = ({ formData, errors, handleInputChange }) => {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-900 mb-2">Email Address</label>
      <input
        name="email"
        type="email"
        required
        value={formData.email}
        onChange={handleInputChange}
        className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl focus:border-lime-400 focus:ring-4 focus:ring-lime-100 transition-all outline-none text-gray-900 font-medium placeholder-gray-400 bg-white/80 backdrop-blur-sm"
        placeholder="john@example.com"
      />
      {errors?.email && (
        <p className="text-sm text-red-600 mt-1">{errors.email}</p>
      )}
    </div>
  );
};
