"use client";

import { useEffect } from 'react';
import HeroAbout from './components/HeroAbout';
import GymAboutSection from '../main/components/GymAboutSection';
import WhyChooseUs from '../main/components/WhyChooseUs';
import GymFolioClasses from '../main/components/GymFolioClasses';
import ContactSection from "../main/components/ContactSection";

const AboutUsComponent: React.FC = () => {
  useEffect(() => {
    // Any global initialization can be added here if needed
  }, []);

  return (
    <main className="pt-20">
  
        <HeroAbout />
        <GymAboutSection />
        <WhyChooseUs />
        <GymFolioClasses />
        <ContactSection />

       
    </main>
  );
};

export default AboutUsComponent;