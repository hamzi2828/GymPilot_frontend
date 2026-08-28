import React from "react";

export const RightSide: React.FC = () => {
  return (
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
    {/* Animated background gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800 animate-pulse"></div>

    {/* Geometric pattern overlay */}
    <div className="absolute inset-0 opacity-10">
      <div
        className="h-full w-full"
        style={{
          backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="%23bee304" stroke-width="1"/></pattern></defs><rect width="200" height="200" fill="url(%23grid)"/></svg>')`,
        }}
      ></div>
    </div>

    {/* Floating geometric shapes */}
    <div className="absolute inset-0">
      <div className="absolute top-20 left-20 w-32 h-32 bg-lime-400 rounded-full opacity-20 animate-bounce" style={{ animationDelay: "0s", animationDuration: "3s" }}></div>
      <div className="absolute top-40 right-32 w-24 h-24 bg-yellow-400 rounded-lg opacity-15 animate-pulse" style={{ animationDelay: "1s", animationDuration: "4s" }}></div>
      <div className="absolute bottom-32 left-32 w-40 h-40 bg-lime-300 rounded-full opacity-10 animate-ping" style={{ animationDelay: "2s", animationDuration: "5s" }}></div>
      <div className="absolute bottom-20 right-20 w-28 h-28 bg-green-400 transform rotate-45 opacity-20 animate-spin" style={{ animationDuration: "20s" }}></div>
    </div>

    {/* Main content */}
    <div className="relative z-20 h-full flex flex-col justify-center items-center text-white p-12">
      <div className="text-center max-w-lg">
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-lime-400 to-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        <h2 className="text-5xl font-black mb-8 text-white font-sans leading-tight">
          Transform Your
          <span className="block text-lime-400">Body & Mind</span>
        </h2>

        <p className="text-xl text-gray-300 mb-12 font-medium leading-relaxed">
          Join thousands of fitness enthusiasts on their journey to peak performance and mental wellness
        </p>

        <div className="grid grid-cols-3 gap-8 text-center">
          <div className="group">
            <div className="text-4xl font-black text-lime-400 mb-2 group-hover:scale-110 transition-transform duration-300">15K+</div>
            <div className="text-sm font-bold text-gray-300 uppercase tracking-wider">Active Members</div>
          </div>
          <div className="group">
            <div className="text-4xl font-black text-lime-400 mb-2 group-hover:scale-110 transition-transform duration-300">1200+</div>
            <div className="text-sm font-bold text-gray-300 uppercase tracking-wider">Workout Plans</div>
          </div>
          <div className="group">
            <div className="text-4xl font-black text-lime-400 mb-2 group-hover:scale-110 transition-transform duration-300">24/7</div>
            <div className="text-sm font-bold text-gray-300 uppercase tracking-wider">Expert Support</div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 space-y-4">
          {["Personalized Training Programs", "Nutrition Guidance & Meal Plans", "Progress Tracking & Analytics"].map((f) => (
            <div key={f} className="flex items-center justify-center space-x-3 text-gray-300">
              <svg className="w-6 h-6 text-lime-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Bottom accent */}
    <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-lime-400 via-yellow-400 to-lime-400"></div>
  </div>
  );
};

export default RightSide;
