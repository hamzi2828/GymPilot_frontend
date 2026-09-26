import React from 'react';

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
// credentials below from the bundle entirely.
export const SHOW_DEMO_LOGINS = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === 'true';

// The credentials match the accounts seeded into the dev database:
//   - admin@demogym.test / admin123     (Seeder/createAdmin.js)
//   - ...@gympilot.test / Gym@12345     (Seeder/createAttendance.js members)
const DEMO = SHOW_DEMO_LOGINS
  ? [
      {
        key: 'admin',
        label: 'Admin',
        caption: 'admin@demogym.test',
        email: 'admin@demogym.test',
        password: 'admin123',
      },
      {
        key: 'user',
        label: 'Member',
        caption: 'ayesha.khan@gympilot.test',
        email: 'ayesha.khan@gympilot.test',
        password: 'Gym@12345',
      },
    ]
  : [];

// The super admin signs in on the platform panel, which lives in its own app
// (GymPilot_marketing) against the platform API, so its card is a plain
// link. That app pre-fills the super admin account when it has one configured;
// nothing about it is stored here.
const PLATFORM_ADMIN_URL = (process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL || 'http://localhost:3001').replace(/\/+$/, '');

const cardClass =
  'group flex flex-col items-start rounded-2xl border-2 border-gray-200 bg-white/80 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#ff6b2c] hover:shadow-md';

export const DemoAccounts: React.FC<DemoAccountsProps> = ({ show, fillCredentials }) => {
  if (!SHOW_DEMO_LOGINS || !show) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Quick demo login
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {DEMO.map((acct) => (
          <button
            key={acct.key}
            type="button"
            onClick={() => fillCredentials(acct.email, acct.password)}
            className={cardClass}
          >
            <span className="text-sm font-black text-gray-900 group-hover:text-[#ff6b2c]">
              {acct.label}
            </span>
            <span className="mt-0.5 truncate text-xs font-medium text-gray-500 w-full">
              {acct.caption}
            </span>
          </button>
        ))}
        <a href={`${PLATFORM_ADMIN_URL}/login?quick=1`} className={`${cardClass} col-span-2`}>
          <span className="text-sm font-black text-gray-900 group-hover:text-[#ff6b2c]">
            Super admin
          </span>
          <span className="mt-0.5 truncate text-xs font-medium text-gray-500 w-full">
            Platform panel · opens the GymPilot admin app
          </span>
        </a>
      </div>
      <p className="text-center text-xs font-medium text-gray-400">
        Tap an account to fill the form, then press Sign In. The super admin signs in on the platform panel.
      </p>
    </div>
  );
};

export default DemoAccounts;
