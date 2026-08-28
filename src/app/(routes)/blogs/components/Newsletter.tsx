"use client";

import React, { useState } from "react";

const Newsletter: React.FC = () => {
  const [email, setEmail] = useState<string>("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Subscribing email:", email);
    setEmail("");
  };

  return (
    <section className="py-20 gym-blog-custom-bg-darker text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="gym-blog-glass-effect rounded-2xl p-8 lg:p-12">
          <h2 className="font-montserrat font-bold text-3xl lg:text-4xl mb-4">
            Join Our Fitness Community
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Get weekly workout tips, nutrition guides, and exclusive member
            stories delivered to your inbox
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-gym-blog-custom-text-green focus:ring-2 focus:ring-gym-blog-custom-text-green/20"
              required
            />
            <button
              type="submit"
              className="gym-blog-custom-gradient-green text-black font-bold px-6 py-3 rounded-lg hover:scale-105 transition-all duration-300 whitespace-nowrap"
            >
              Subscribe Now
            </button>
          </form>
          <p className="text-sm text-gray-400 mt-4">
            Join 50,000+ fitness enthusiasts. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Newsletter;