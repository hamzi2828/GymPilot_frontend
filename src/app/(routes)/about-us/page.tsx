"use client";

import HeroAbout from './components/HeroAbout';
import GymAboutSection from '../main/components/GymAboutSection';
import GymFolioClasses from '../main/components/GymFolioClasses';
import ContactSection from "../main/components/ContactSection";

const AboutUsComponent: React.FC = () => {
  // No top padding — HeroAbout is full-bleed and the header floats on it.
  return (
    <main>
      <HeroAbout />
      <GymAboutSection />
      <GymFolioClasses />
      <ContactSection />
    </main>
  );
};

export default AboutUsComponent;
