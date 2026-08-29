// app/(routes)/main/page.tsx
//
// The hero banner is managed in /admin/hero-slides; every section after it is
// managed in /admin/homepage (order, visibility and content all come from the
// backend — see HomeSections).
import HeroCarousel from "./components/HeroCarousel";
import HomeSections from "./components/HomeSections";

export default function MainPage() {
  return (
    <main className="pt-20">
      <HeroCarousel />
      <HomeSections />
    </main>
  );
}
