"use client";

// Checking in from the member's own phone: scan the code on the screen at the
// front desk. The same scanner and answers as the /checkin page a phone's
// camera app opens (components/checkin). Members no longer show a code of
// their own at the desk, and the kiosk no longer takes a typed member number.

import React from "react";
import CheckinFlow from "@/components/checkin/CheckinFlow";

export const CheckInSection: React.FC<{ onSessionEnded: () => void; onRecorded?: () => void }> = ({ onSessionEnded, onRecorded }) => {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 sm:p-8">
        <CheckinFlow variant="panel" onSessionEnded={onSessionEnded} onRecorded={onRecorded} />
      </section>
      <section className="rounded-2xl border-2 border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-black">Other ways to check in</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Fingerprint or face at the front desk, where the gym has them.</li>
          <li>No phone with you? A member of staff can check you in by name.</li>
        </ul>
      </section>
    </div>
  );
};

export default CheckInSection;
