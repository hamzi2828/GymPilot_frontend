"use client";

import { useEffect, useState } from "react";
import HeroAbout from './components/HeroAbout';
import GymAboutSection from '../main/components/GymAboutSection';
import GymFolioClasses from '../main/components/GymFolioClasses';
import ContactSection from "../main/components/ContactSection";
import {
  AboutContent,
  ContactContent,
  DEFAULT_ABOUT,
  DEFAULT_CLASSES,
  DEFAULT_CONTACT,
  HomeSection,
  SectionHeaderContent,
  homeService,
  mergeContent,
} from "../main/services/homeService";

const AboutUsComponent: React.FC = () => {
  // The About copy is what the gym wrote for its homepage sections
  // (Admin -> Homepage). Until that arrives, or when the gym has written
  // none, the page shows no About text at all rather than a stand-in.
  const [sections, setSections] = useState<HomeSection[]>([]);

  useEffect(() => {
    let cancelled = false;
    homeService
      .getSections()
      .then((data) => {
        if (!cancelled) setSections(data);
      })
      .catch(() => {
        /* the classes and the enquiry form below still render */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const contentOf = (key: HomeSection["key"]) => sections.find((s) => s.key === key)?.content;
  const about = contentOf("about");

  // No top padding — HeroAbout is full-bleed and the header floats on it.
  return (
    <main>
      <HeroAbout />
      {about && <GymAboutSection content={mergeContent<AboutContent>(DEFAULT_ABOUT, about)} />}
      <GymFolioClasses content={mergeContent<SectionHeaderContent>(DEFAULT_CLASSES, contentOf("classes"))} />
      <ContactSection content={mergeContent<ContactContent>(DEFAULT_CONTACT, contentOf("contact"))} />
    </main>
  );
};

export default AboutUsComponent;
