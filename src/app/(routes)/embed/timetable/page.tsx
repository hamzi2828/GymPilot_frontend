// The timetable on its own, for an <iframe> on another website. The site
// chrome is hidden for /embed/* by ClientLayout; booking still works, and when
// the visitor needs to sign in first that opens in the whole browser window
// (see openInTopWindow in classes/components/SessionBooking), not inside the
// frame.

import EmbedTimetable from "./EmbedTimetable";

export const metadata = { title: "Timetable", robots: { index: false, follow: false } };

export default function EmbeddedTimetable() {
  return (
    <div className="embed-timetable">
      <EmbedTimetable />
    </div>
  );
}
