"use client";

import React from "react";
import {
  HeroSection,
  FeaturedStories,
  Newsletter,
  LatestArticles,
} from "./components";

// No stats band here: the one this page had claimed "50K+ members" and "1M+
// lives transformed" on every gym's site. The homepage's stats section is the
// gym-managed one.
const Blogs: React.FC = () => {
  return (
    <main className="pt-14">
      <HeroSection />
      <FeaturedStories />
      <Newsletter />
      <LatestArticles />
    </main>
  );
};

export default Blogs;
