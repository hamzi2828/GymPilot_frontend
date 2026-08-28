"use client";

import React, { useCallback } from "react";
import "@fortawesome/fontawesome-free/css/all.css";
import { useRouter } from "next/navigation";
import ContactSection from "../main/components/ContactSection";
import GymfolioAllClasses from "./components/GymfolioAllClasses";
import HeroAbout from "../about-us/components/HeroAbout";
import { GymClass } from "../main/services/gymClassService";

const Classes = () => {
  const router = useRouter();

  const handleClassClick = useCallback((gymClass: GymClass) => {
    // Navigate to class detail page with the class ID
    router.push(`/classdetail?id=${gymClass._id}`);
  }, [router]);

  return (
    <main className="pt-20">

        <HeroAbout />
            <GymfolioAllClasses onClassClick={handleClassClick} />
            <ContactSection/>


    </main>
  );
};

export default Classes;