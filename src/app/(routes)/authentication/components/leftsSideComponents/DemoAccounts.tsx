import React from 'react';
import s from '../../auth.module.css';

interface DemoAccountsProps {
  /** True only on the sign-in screen -- these shortcuts make no sense on
      sign-up or the two reset steps, so they are hidden there. */
  show: boolean;
  /** Drops a known-good email + password straight into the form so a reviewer
      can sign in with one tap on the button, then Sign In. */
  fillCredentials: (email: string, password: string) => void;
}

// Demo logins are for reviewers on a dev/staging build only. Every gym's real
// sign-in page renders this component, so it stays hidden unless the build sets
// NEXT_PUBLIC_SHOW_DEMO_LOGINS=true. next.config.ts always defines the flag, so
// in a normal build this is a constant `false` and the minifier drops the
// accounts below from the bundle entirely.
export const SHOW_DEMO_LOGINS = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true';

// Which accounts the buttons fill in comes from the build's environment, never
// from this file: the source is public, and a sign-in name and password written
// here are published with it. A demo build sets, for the accounts it has seeded:
//
//   NEXT_PUBLIC_DEMO_ADMIN_LOGIN   / NEXT_PUBLIC_DEMO_ADMIN_PASSWORD
//   NEXT_PUBLIC_DEMO_MEMBER_LOGIN  / NEXT_PUBLIC_DEMO_MEMBER_PASSWORD
//
// A button appears only for a pair that is set in full. (Like every
// NEXT_PUBLIC_ value these end up in that build's JavaScript, which is the
// point of a demo login -- so only ever demo accounts.)
const DEMO = SHOW_DEMO_LOGINS
  ? [
      {
        key: 'admin',
        label: 'Admin',
        email: process.env.NEXT_PUBLIC_DEMO_ADMIN_LOGIN || '',
        password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD || '',
      },
      {
        key: 'user',
        label: 'Member',
        email: process.env.NEXT_PUBLIC_DEMO_MEMBER_LOGIN || '',
        password: process.env.NEXT_PUBLIC_DEMO_MEMBER_PASSWORD || '',
      },
    ].filter((acct) => acct.email && acct.password)
  : [];

// The super admin signs in on the platform panel, which lives in its own app
// (GymPilot_marketing) against the platform API, so its card is a plain
// link. That app pre-fills the super admin account when it has one configured;
// nothing about it is stored here.
const PLATFORM_ADMIN_URL = (process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL || 'http://localhost:3001').replace(/\/+$/, '');

export const DemoAccounts: React.FC<DemoAccountsProps> = ({ show, fillCredentials }) => {
  if (!SHOW_DEMO_LOGINS || !show) return null;
  return (
    <div>
      <div className={s.divider}>Quick demo login</div>
      <div className={s.demoGrid}>
        {DEMO.map((acct) => (
          <button
            key={acct.key}
            type="button"
            onClick={() => fillCredentials(acct.email, acct.password)}
            className={s.demoCard}
          >
            <span className={s.demoName}>{acct.label}</span>
            <span className={s.demoMeta}>{acct.email}</span>
          </button>
        ))}
        <a href={`${PLATFORM_ADMIN_URL}/login?quick=1`} className={`${s.demoCard} ${s.demoWide}`}>
          <span className={s.demoName}>Super admin</span>
          <span className={s.demoMeta}>Platform panel · opens the GymsPilotPro admin app</span>
        </a>
      </div>
      <p className={s.demoNote}>
        Tap an account to fill the form, then press Sign In. The super admin signs in on the platform panel.
      </p>
    </div>
  );
};

export default DemoAccounts;
