"use client";

import React from "react";

const StatsSection: React.FC = () => {
  return (
    <section className="py-20 gym-blog-custom-bg-dark text-white">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="font-montserrat font-black text-4xl lg:text-6xl gym-blog-custom-text-green mb-2">
              50K+
            </div>
            <p className="text-gray-400 uppercase tracking-wide text-sm">
              Community Members
            </p>
          </div>
          <div className="text-center">
            <div className="font-montserrat font-black text-4xl lg:text-6xl gym-blog-custom-text-green mb-2">
              500+
            </div>
            <p className="text-gray-400 uppercase tracking-wide text-sm">
              Success Stories
            </p>
          </div>
          <div className="text-center">
            <div className="font-montserrat font-black text-4xl lg:text-6xl gym-blog-custom-text-green mb-2">
              200+
            </div>
            <p className="text-gray-400 uppercase tracking-wide text-sm">
              Workout Programs
            </p>
          </div>
          <div className="text-center">
            <div className="font-montserrat font-black text-4xl lg:text-6xl gym-blog-custom-text-green mb-2">
              1M+
            </div>
            <p className="text-gray-400 uppercase tracking-wide text-sm">
              Lives Transformed
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;