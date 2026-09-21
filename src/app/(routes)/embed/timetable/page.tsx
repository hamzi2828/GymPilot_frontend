// The timetable on its own, for an <iframe> on another website. The site
// chrome is hidden for /embed/* by ClientLayout; booking still works, and when
// the visitor needs to sign in first that opens in the whole browser window
// (see openInTopWindow in the timetable page), not inside the frame.

import TimetablePage from "../../timetable/page";

export const metadata = { title: "Timetable", robots: { index: false, follow: false } };

export default function EmbeddedTimetable() {
  return (
    <div className="embed-timetable">
      <TimetablePage />
    </div>
  );
}
