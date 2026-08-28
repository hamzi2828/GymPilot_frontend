import React from 'react';
import type { FormData, Errors } from './types';

interface NameFieldsProps {
  isSignUp: boolean;
  formData: FormData;
  errors?: Errors;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const NameFields: React.FC<NameFieldsProps> = ({ isSignUp, formData, errors, handleInputChange }) => {
  if (!isSignUp) return null;
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-bold text-gray-900 mb-2">First Name</label>
        <input
          name="firstName"
          type="text"
          required
          value={formData.firstName}
          onChange={handleInputChange}
          className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl focus:border-lime-400 focus:ring-4 focus:ring-lime-100 transition-all outline-none text-gray-900 font-medium placeholder-gray-400 bg-white/80 backdrop-blur-sm"
          placeholder="John"
        />
        {errors?.firstName && (
          <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-bold text-gray-900 mb-2">Last Name</label>
        <input
          name="lastName"
          type="text"
          required
          value={formData.lastName}
          onChange={handleInputChange}
          className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl focus:border-lime-400 focus:ring-4 focus:ring-lime-100 transition-all outline-none text-gray-900 font-medium placeholder-gray-400 bg-white/80 backdrop-blur-sm"
          placeholder="Doe"
        />
        {errors?.lastName && (
          <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>
        )}
      </div>
    </div>
  );
};
