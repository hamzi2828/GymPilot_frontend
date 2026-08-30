"use client";

import React from "react";
import "@fortawesome/fontawesome-free/css/all.css";
import GymfolioPricing from "./components/GymfolioPricing";
import ContactSection from "../main/components/ContactSection";
import HeroCarousel from "../main/components/HeroCarousel";
const Packages = () => {
  return (
    // No top padding: HeroCarousel is full-bleed and the header floats on it.
    <main>
      <HeroCarousel compact />
      <GymfolioPricing />
      <ContactSection/>
           
         
    </main>
  );
};

export default Packages;