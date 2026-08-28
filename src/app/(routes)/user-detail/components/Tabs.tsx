import React from "react";

export interface TabsProps {
  activeTab: "profile" | "orders";
  onChange: (tab: "profile" | "orders") => void;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onChange }) => {
  return (
    <div className="border-b border-gray-200 mb-8 overflow-x-auto">
      <nav className="flex gap-6 min-w-max">
        {[
          { key: "profile", label: "Profile", icon: "fas fa-user" },
          { key: "orders", label: "Orders", icon: "fas fa-shopping-bag" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key as "profile" | "orders")}
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
