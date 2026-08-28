import React from 'react';

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
  return (
    <div>
      <label className="block text-sm font-bold text-gray-900 mb-2">{label}</label>
      <div className="relative">
        <input
          name="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          required
          value={value}
          onChange={handleInputChange}
          className="w-full pl-4 pr-14 py-4 border-2 border-gray-200 rounded-2xl focus:border-lime-400 focus:ring-4 focus:ring-lime-100 transition-all outline-none text-gray-900 font-medium placeholder-gray-400 bg-white/80 backdrop-blur-sm"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-lime-600 transition-colors"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showConfirmPassword ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            )}
          </svg>
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
};
