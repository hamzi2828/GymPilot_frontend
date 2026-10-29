import React from 'react';
import s from '../../auth.module.css';

interface HeaderProps {
  isSignUp: boolean;
  isForgot: boolean;
  isReset?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isSignUp, isForgot, isReset = false }) => {
  const eyebrow = isReset || isForgot ? 'Account recovery' : isSignUp ? 'New member' : 'Members area';
  // Last word of the title takes the accent.
  const [lead, accent] = isReset
    ? ['New', 'password']
    : isForgot
    ? ['Forgot', 'password?']
    : isSignUp
    ? ['Join', 'us']
    : ['Welcome', 'back'];
  return (
    <div className={s.head}>
      <span className={s.eyebrow}>
        <span className={s.dot} aria-hidden="true" />
        {eyebrow}
      </span>
      <h1 className={s.title}>
        {lead} <span className={s.titleAccent}>{accent}</span>
      </h1>
      <p className={s.sub}>
        {isReset
          ? 'Choose the password you will sign in with from now on'
          : isForgot
          ? 'Enter your email and we will send you a link to reset it'
          : isSignUp
          ? 'Start your fitness transformation today'
          : 'Continue your fitness journey'}
      </p>
    </div>
  );
};
