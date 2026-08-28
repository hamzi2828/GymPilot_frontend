"use client";

import React from "react";
import {
  HeroSection,
  FeaturedStories,
  Newsletter,
  StatsSection,
  LatestArticles,
} from "./components";

const Blogs: React.FC = () => {
  return (
    <main className="pt-14">
      <HeroSection />
      <FeaturedStories />
      <Newsletter />
      <StatsSection />
      <LatestArticles />
    </main>
  );
};

export default Blogs;