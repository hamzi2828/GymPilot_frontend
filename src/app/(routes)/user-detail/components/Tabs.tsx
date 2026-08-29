import React from "react";

export type UserTab = "profile" | "history";

export interface TabsProps {
  activeTab: UserTab;
  onChange: (tab: UserTab) => void;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onChange }) => {
  return (
    <div className="border-b border-gray-200 mb-8 overflow-x-auto">
      <nav className="flex gap-6 min-w-max">
        {[
          { key: "profile", label: "Profile", icon: "fas fa-user" },
          // "History" rather than "Orders": what a member has here is a
          // membership and a record of turning up, not a parcel.
          { key: "history", label: "History", icon: "fas fa-clock-rotate-left" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key as UserTab)}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            <i className={tab.icon} /> {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Tabs;
