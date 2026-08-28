import React from 'react';

interface HeaderProps {
  isSignUp: boolean;
  isForgot: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isSignUp, isForgot }) => {
  return (
    <div className="text-center">
      <div className="mb-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-lime-400 via-lime-500 to-yellow-400 flex items-center justify-center mx-auto shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
          <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
      <h1 className="text-5xl font-black text-gray-900 leading-tight tracking-tight mb-3 font-sans">
        {isForgot ? 'Reset Password' : isSignUp ? 'Join Us' : 'Welcome'}
      </h1>
      <p className="text-gray-600 text-base font-medium leading-relaxed">
        {isForgot
          ? 'Set a new password for your account'
          : isSignUp
          ? 'Start your fitness transformation today'
          : 'Continue your fitness journey'}
      </p>
    </div>
  );
};
