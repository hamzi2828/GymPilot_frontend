"use client";

import React, { useState, useCallback } from "react";
import "@fortawesome/fontawesome-free/css/all.css";

import ContactSection from "../main/components/ContactSection";
import GymTrainersSection from "./components/GymTrainersSection";
import HeroAbout from "../about-us/components/HeroAbout";
import TrainerDetail from "./components/TrainerDetail";
import { Trainer } from "../main/services/trainerService";

const Trainers = () => {
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);

  const handleTrainerClick = useCallback((trainer: Trainer) => {
    setSelectedTrainer(trainer);
  }, []);

  return (
    <main className="pt-20">

        <HeroAbout />
        <TrainerDetail trainer={selectedTrainer} />
           <GymTrainersSection onTrainerClick={handleTrainerClick} />
            <ContactSection/>

        {/* Client reviews are intentionally not rendered: the component still
            holds placeholder testimonials with invented names and avatars.
            Wire it to real, attributable member reviews before bringing it
            back: publishing fabricated testimonials misleads visitors. */}
    </main>
  );
};

export default Trainers;