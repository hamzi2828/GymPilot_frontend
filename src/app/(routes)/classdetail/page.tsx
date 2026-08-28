"use client";
import React, { useState, useEffect, Suspense } from "react";
import "@fortawesome/fontawesome-free/css/all.css";
import { useSearchParams } from "next/navigation";
import GymClassDetailSection from "./components/GymClassDetailSection";
import ContactSection from "../main/components/ContactSection";
import HeroAbout from "../about-us/components/HeroAbout";
import GymTrainersSection from "./components/GymTrainersSection";
import { gymClassService, GymClass } from "../main/services/gymClassService";

const ClassDetailContent = () => {
  const searchParams = useSearchParams();
  const classId = searchParams.get('id');
  const [selectedClass, setSelectedClass] = useState<GymClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClassDetail = async () => {
      if (!classId) {
        setError("No class ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const classData = await gymClassService.getClassById(classId);
        setSelectedClass(classData);
      } catch (err) {
        console.error("Error fetching class details:", err);
        setError(err instanceof Error ? err.message : "Failed to load class details");
      } finally {
        setLoading(false);
      }
    };

    fetchClassDetail();
  }, [classId]);

  if (loading) {
    return (
      <main className="pt-20">
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#91b200]"></div>
        </div>
      </main>
    );
  }

  if (error || !selectedClass) {
    return (
      <main className="pt-20">
        <div className="flex justify-center items-center min-h-screen">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-center max-w-2xl">
            {error || "Class not found"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-20">
        <HeroAbout />
      <GymClassDetailSection gymClass={selectedClass} />
<GymTrainersSection />
        <ContactSection />
    </main>
  );
};

const ClassDetail = () => {
  return (
    <Suspense fallback={
      <main className="pt-20">
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#91b200]"></div>
        </div>
      </main>
    }>
      <ClassDetailContent />
    </Suspense>
  );
};

export default ClassDetail;