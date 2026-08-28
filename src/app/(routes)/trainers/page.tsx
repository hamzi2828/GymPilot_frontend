"use client";

import React, { useState, useCallback } from "react";
import "@fortawesome/fontawesome-free/css/all.css";

import ContactSection from "../main/components/ContactSection";
import GymTrainersSection from "./components/GymTrainersSection";
import HeroAbout from "../about-us/components/HeroAbout";
import TrainerDetail from "./components/TrainerDetail";
import Clientreviews from "./components/Clientreviews";
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

         <Clientreviews/>
    </main>
  );
};

export default Trainers;