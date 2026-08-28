"use client";

import React from "react";
import "@fortawesome/fontawesome-free/css/all.css";
import GymfolioPricing from "./components/GymfolioPricing";
import ContactSection from "../main/components/ContactSection";
import HeroCarousel from "../main/components/HeroCarousel";
const Packages = () => {
  return (
    <main className="pt-20">
      
       <HeroCarousel />
      <GymfolioPricing />
      <ContactSection/>
           
         
    </main>
  );
};

export default Packages;