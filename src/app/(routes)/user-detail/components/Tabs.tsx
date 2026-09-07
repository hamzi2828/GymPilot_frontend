import React from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { DictKey } from "@/i18n/dictionaries";

export type UserTab = "profile" | "bookings" | "pt" | "history" | "visits" | "checkin" | "work";

/** Tab keys in the order they appear, so the URL and the UI cannot drift. */
export const USER_TABS: { key: UserTab; label: string; icon: string }[] = [
  { key: "profile", label: "Profile", icon: "fas fa-user" },
  // Sits second because it is the only tab a member acts on rather than reads:
  // everything below it is a record of what already happened.
  { key: "bookings", label: "My classes", icon: "fas fa-calendar-days" },
  { key: "pt", label: "Personal training", icon: "fas fa-dumbbell" },
  // "History" rather than "Orders": what a member has here is a
  // membership and a record of turning up, not a parcel.
  { key: "history", label: "History", icon: "fas fa-clock-rotate-left" },
  // Attendance used to live at the bottom of History, where it was three
  // scrolls below the thing it belongs to. It is its own view now.
  { key: "visits", label: "Recent visits", icon: "fas fa-calendar-check" },
  { key: "checkin", label: "Check-in QR", icon: "fas fa-qrcode" },
  // Staff accounts only: shifts, leave and payslips. Hidden for members.
  { key: "work", label: "My work", icon: "fas fa-briefcase" },
];

/** Narrows an arbitrary `?tab=` value, keeping the legacy `orders` alias. */
export function parseUserTab(value: string | null): UserTab | null {
  if (!value) return null;
  // Links and emails sent before this tab was renamed should not land on a tab
  // that no longer exists.
  if (value === "orders") return "history";
  return USER_TABS.some((tab) => tab.key === value) ? (value as UserTab) : null;
}

export interface TabsProps {
  activeTab: UserTab;
  onChange: (tab: UserTab) => void;
  /** Tabs to leave out for this account (e.g. "work" for members). */
  hide?: UserTab[];
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onChange, hide = [] }) => {
  const { t } = useLanguage();
  return (
    <div className="border-b border-gray-200 mb-8 overflow-x-auto">
      <nav className="flex gap-6 min-w-max">
        {USER_TABS.filter((tab) => !hide.includes(tab.key)).map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            aria-current={activeTab === tab.key ? "page" : undefined}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            <i className={tab.icon} /> {t(`tab.${tab.key}` as DictKey)}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Tabs;
