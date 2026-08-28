import React from "react";

export interface StatsSectionProps {
  joinedDate: string;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
}

export const StatsSection: React.FC<StatsSectionProps> = ({
  joinedDate,
  totalOrders,
  totalSpent,
  loyaltyPoints,
}) => {
  return (
    <section className="px-4 sm:px-6 lg:px-8 xl:px-20 py-12 bg-gray-50 border-t border-gray-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-primary rounded-full flex items-center justify-center">
            <i className="fas fa-user text-black text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-black">Member Since</h3>
          <p className="text-gray-500">
            {new Date(joinedDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
          </p>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center">
            <i className="fas fa-shopping-bag text-blue-500 text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-black">{totalOrders} Orders</h3>
          <p className="text-gray-500">Total orders placed</p>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
            <i className="fas fa-rupee-sign text-green-500 text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-black">Rs {totalSpent.toLocaleString()}</h3>
          <p className="text-gray-500">Total amount spent</p>
        </div>

        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 bg-yellow-100 rounded-full flex items-center justify-center">
            <i className="fas fa-star text-yellow-500 text-2xl" />
          </div>
          <h3 className="text-lg font-bold text-black">{loyaltyPoints} Points</h3>
          <p className="text-gray-500">Loyalty points earned</p>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
