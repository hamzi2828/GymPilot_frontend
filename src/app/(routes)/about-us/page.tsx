"use client";

import HeroAbout from './components/HeroAbout';
import GymAboutSection from '../main/components/GymAboutSection';
import GymFolioClasses from '../main/components/GymFolioClasses';
import ContactSection from "../main/components/ContactSection";

const AboutUsComponent: React.FC = () => {
  return (
    <main className="pt-20">
      <HeroAbout />
      <GymAboutSection />
      <GymFolioClasses />
      <ContactSection />
    </main>
  );
};

export default AboutUsComponent;
