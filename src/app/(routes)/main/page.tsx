// app/(routes)/main/page.tsx
import HeroCarousel from "./components/HeroCarousel";
import WhyChooseUs from "./components/WhyChooseUs";
import BlogsSection from "./components/BlogsSection";
import GymAboutSection from "./components/GymAboutSection";
import GymFolioClasses from "./components/GymFolioClasses";
import GymfolioGallery from "./components/GymfolioGallery";
import GymTrainersSection from "./components/GymTrainersSection";
import ContactSection from "./components/ContactSection";

export default function MainPage() {
  return (
    <main className="pt-20">
      <HeroCarousel />
      <GymAboutSection />
      <WhyChooseUs /> 
      <GymFolioClasses />
      <GymfolioGallery />
      <GymTrainersSection />
      <ContactSection />
      <BlogsSection />
    </main>
  );
}
