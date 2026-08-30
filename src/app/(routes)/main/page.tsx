// app/(routes)/main/page.tsx
//
// The hero banner is managed in /admin/hero-slides; every section after it is
// managed in /admin/homepage (order, visibility and content all come from the
// backend — see HomeSections).
import HeroCarousel from "./components/HeroCarousel";
import HomeSections from "./components/HomeSections";

export default function MainPage() {
  // No top padding: the banner is full-bleed and the header floats over it
  // with no surface of its own, so the artwork starts at the very top edge.
  return (
    <main>
      <HeroCarousel />
      <HomeSections />
    </main>
  );
}
