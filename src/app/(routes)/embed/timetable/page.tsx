// The timetable on its own, for an <iframe> on another website. The site
// chrome is hidden for /embed/* by ClientLayout; booking still works and
// sends the visitor to sign in on this site when they tap Book.

import TimetablePage from "../../timetable/page";

export const metadata = { title: "Timetable", robots: { index: false, follow: false } };

export default function EmbeddedTimetable() {
  return (
    <div className="embed-timetable">
      <TimetablePage />
    </div>
  );
}
