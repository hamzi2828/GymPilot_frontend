"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "./components/Header";
import { Tabs, parseUserTab, UserTab } from "./components/Tabs";
import { BookingsSection } from "./components/BookingsSection";
import { ProfileSection, type SaveResult } from "./components/ProfileSection";
import { HistorySection } from "./components/HistorySection";
import { VisitsSection } from "./components/VisitsSection";
import { CheckInSection } from "./components/CheckInSection";
import { PrivacySection } from "./components/PrivacySection";
import { NotificationsSection } from "./components/NotificationsSection";
import { ProfileExtrasSection } from "./components/ProfileExtrasSection";
import { PtSection } from "./components/PtSection";
import { WorkSection, type Work } from "./components/WorkSection";
import { ShopSection } from "./components/ShopSection";
import { EmailConfirmNotice } from "./components/EmailConfirmNotice";
import { getAuthHeader } from "@/helper/helper";
import {
  getUserDetailForProfile,
  updateUser,
  getMembershipHistory,
  getMyAttendance,
  SessionEndedError,
  RequestError,
  PASSWORD_REQUIRED,
  PASSWORD_INCORRECT,
} from "./service/userDetailService";
import { getCurrentUser, removeToken, signInUrl, UserPayload } from "@/helper/helper";
import { localDateKey, toDateInputValue } from "@/helper/date";

import {
  UserProfile,
  MembershipOrder,
  MyAttendance,
} from "./service/userDetailService";

// Accept backend-specific fields when hydrating from API
type BackendUserPayload = Partial<UserProfile> & {
  _id?: string;
  avatarUrl?: string | null;
};

const UserProfilePageContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<UserTab>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: "success" | "error" | "info" }>({
    show: false,
    msg: "",
    type: "success",
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [memberships, setMemberships] = useState<MembershipOrder[]>([]);
  const [attendance, setAttendance] = useState<MyAttendance | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Why the memberships / the visits could not be loaded. Kept apart from
  // "there are none": over a failed request, "You have not bought a package
  // yet" with a See packages button invites a member to pay twice.
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  // Staff accounts get a "My work" tab; the API answers null for members.
  const [work, setWork] = useState<Work | null>(null);
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    fetch(`${base}/staff/me/work`, { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setWork(json?.data || null))
      .catch(() => setWork(null));
  }, []);

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type }), 2500);
  };

  // The API says the session is over. The stored session is cleared first --
  // it is no use any more -- and sign-in brings the member back to this tab.
  const endSession = () => {
    removeToken();
    router.replace(signInUrl());
  };

  // Packages and visits are fetched together -- the History tab is one story
  // told in two halves, and loading them separately would show it half-drawn.
  // Settled rather than awaited as a pair, so a member with no attendance yet
  // still sees their membership.
  const fetchHistory = async (): Promise<void> => {
    try {
      setHistoryLoading(true);
      const [packages, visits] = await Promise.allSettled([getMembershipHistory(), getMyAttendance()]);

      if ([packages, visits].some((r) => r.status === "rejected" && r.reason instanceof SessionEndedError)) {
        endSession();
        return;
      }
      const why = (reason: unknown, fallback: string) => (reason instanceof Error && reason.message ? reason.message : fallback);

      if (packages.status === "fulfilled") {
        setMemberships(packages.value);
        setMembershipError(null);
      } else {
        setMembershipError(why(packages.reason, "We could not load your membership."));
      }

      if (visits.status === "fulfilled") {
        setAttendance(visits.value);
        setVisitsError(null);
      } else {
        setVisitsError(why(visits.reason, "We could not load your visits."));
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  // Drilling into a month refetches, because the default response carries only
  // the recent-visits window -- filtering it in the browser would quietly show
  // part of an older month and call it the whole thing.
  const selectMonth = async (key: string | null) => {
    setSelectedMonth(key);
    try {
      setMonthLoading(true);
      const data = await getMyAttendance(key || undefined);
      setAttendance(data);
    } catch (e) {
      if (e instanceof SessionEndedError) {
        endSession();
        return;
      }
      showToast(e instanceof Error ? e.message : "Could not load that month", "error");
      setSelectedMonth(null);
    } finally {
      setMonthLoading(false);
    }
  };

  // Fetch & merge user data from API/service
  const refreshUserData = async (): Promise<void> => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        router.replace(signInUrl());
        return;
      }

      const resp = await getUserDetailForProfile();
      // Handle both { data: UserProfile } and direct UserProfile responses
      const payload = (resp && typeof resp === 'object' && 'data' in resp) 
        ? (resp as { data: Partial<UserProfile> }).data
        : (resp as Partial<UserProfile> | undefined);
      if (!payload) return;
      const pl: BackendUserPayload = payload as BackendUserPayload;

      setUserProfile(prev => {
        const base: UserProfile =
          prev ??
          ({
            id: currentUser.id,
            firstName: "",
            lastName: "",
            email: currentUser.email ?? "",
            phone: "",
            // No birthday on file stays blank; see toDateInputValue.
            dateOfBirth: "",
            gender: "other",
            // Blank shows the member's initial rather than a stock picture.
            profileImage: "",
            joinedDate: new Date().toISOString(),
            totalOrders: 0,
            totalSpent: 0,
            loyaltyPoints: 0,
          } as UserProfile);

        return {
          ...base,
          ...pl,
          id: pl._id ?? pl.id ?? base.id,
          // The API's answer is the truth here: an account with no email (or
          // one whose email was just removed) must not keep showing the one
          // from the sign-in token.
          email: pl.email ?? "",
          firstName: pl.firstName ?? base.firstName,
          lastName: pl.lastName ?? base.lastName,
          phone: pl.phone ?? base.phone,
          gender: (pl.gender as UserProfile["gender"]) ?? base.gender,
          dateOfBirth: toDateInputValue(pl.dateOfBirth ?? base.dateOfBirth),
          profileImage: pl.avatarUrl ?? pl.profileImage ?? base.profileImage,
          joinedDate: pl.joinedDate ?? base.joinedDate,
          totalOrders: pl.totalOrders ?? base.totalOrders,
          totalSpent: pl.totalSpent ?? base.totalSpent,
          loyaltyPoints: pl.loyaltyPoints ?? base.loyaltyPoints,
        };
      });
    } catch (error) {
      if (error instanceof SessionEndedError) {
        endSession();
        return;
      }
      console.error("Error refreshing user data:", error);
      showToast(error instanceof Error ? error.message : "Failed to refresh user data", "error");
    }
  };

  // The URL is the source of truth for which tab is open, so a member can
  // bookmark, refresh or share "my visits" and land back on it. `parseUserTab`
  // still honours the legacy `?tab=orders` alias.
  useEffect(() => {
    setActiveTab(parseUserTab(searchParams.get("tab")) ?? "profile");
  }, [searchParams]);

  // `replace`, not `push`: flipping between tabs should not stack up history
  // entries the back button then has to walk through.
  const handleTabChange = (tab: UserTab) => {
    setActiveTab(tab);
    router.replace(`/user-detail?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    const u = getCurrentUser() as UserPayload | null;
    if (!u) {
      router.replace(signInUrl());
      return;
    }
    // Seed with token data first
    setUserProfile({
      id: u.id,
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      // Blank for an account that signs in by username.
      email: u.email ?? "",
      phone: "",
      dateOfBirth: "",
      gender: "other",
      profileImage: "",
      joinedDate: localDateKey(),
      totalOrders: 0,
      totalSpent: 0,
      loyaltyPoints: 0,
    });
    // Then hydrate from API
    refreshUserData();
    // Fetch membership + attendance history
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Parent-owned save handler. `change.email` is set only when the member
  // changed their address, and then comes with their current password: the
  // API asks for it before moving an account to a different mailbox.
  const handleSave = async (
    userData: Pick<UserProfile, "firstName" | "lastName" | "phone" | "dateOfBirth" | "gender">,
    change?: { email: string; currentPassword: string }
  ): Promise<SaveResult> => {
    try {
      setSaving(true);

      if (!userData.firstName?.trim() || !userData.lastName?.trim()) {
        return { ok: false, message: "First and last name are required" };
      }

      const result = await updateUser(change ? { ...userData, email: change.email, currentPassword: change.currentPassword } : userData);
      if (!result) {
        throw new Error("No data returned from server");
      }

      await refreshUserData();
      // The API's own sentence when it has something to say (an email that
      // was removed, and the username to sign in with from now on).
      const said = typeof result.message === "string" && result.message !== "User updated successfully" ? result.message : "";
      showToast(said || "Profile updated successfully", "success");
      return { ok: true };
    } catch (e) {
      if (e instanceof SessionEndedError) {
        endSession();
        return { ok: false, message: e.message };
      }
      if (e instanceof RequestError && e.code === PASSWORD_REQUIRED) {
        return { ok: false, needsPassword: true, message: "Enter your current password to change your email." };
      }
      if (e instanceof RequestError && e.code === PASSWORD_INCORRECT) {
        return { ok: false, needsPassword: true, message: "That password is not right, so your email was not changed. Try again." };
      }
      console.error("Update error:", e);
      return { ok: false, message: e instanceof Error ? e.message : "Failed to update profile" };
    } finally {
      setSaving(false);
    }
  };

  if (!userProfile) return null;

  return (
    <main className="pt-20 bg-white">
      {/* Maps this page's `primary` utilities onto the site-wide accent token,
          so the member area follows whichever palette admin has selected
          instead of pinning itself to orange. */}
      <style jsx global>{`
        .text-primary {
          color: var(--accent, #ff6b2c);
        }
        .bg-primary {
          background-color: var(--accent, #ff6b2c);
        }
        .border-primary {
          border-color: var(--accent, #ff6b2c);
        }
      `}</style>

      {toast.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow ${
            toast.type === "success"
              ? "bg-green-50 text-gray-800 border-l-4 border-primary"
              : toast.type === "error"
              ? "bg-red-50 text-red-700 border-l-4 border-red-500"
              : "bg-blue-50 text-blue-700 border-l-4 border-blue-500"
          }`}
        >
          <div className="flex items-center">
            <span className="font-medium">{toast.msg}</span>
            <button
              onClick={() => setToast({ show: false, msg: "", type: toast.type })}
              className="ml-3 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <section className="px-4 sm:px-6 lg:px-8 xl:px-20 py-8 sm:py-12">
        <Header userProfile={userProfile} />
        {/* Only for an address the API says is unconfirmed: an account with
            no email, or one from before confirmation existed, sees nothing. */}
        {!isEditing && userProfile.email && userProfile.emailVerified === false && (
          <EmailConfirmNotice
            onConfirmed={(message) => {
              showToast(message, "success");
              refreshUserData();
            }}
            onSessionEnded={endSession}
          />
        )}
        <Tabs activeTab={activeTab} onChange={handleTabChange} hide={work ? [] : ["work"]} />

        {activeTab === "profile" && (
          <ProfileSection<UserProfile>
            userProfile={userProfile}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            setUserProfile={setUserProfile}
            showToast={showToast}
            onSave={handleSave}              // ✅ pass function, not result
            isSaving={saving}                // ✅ parent controls saving state
          />
        )}
        {activeTab === "profile" && userProfile && (
          <PrivacySection
            twoFactorEnabled={!!(userProfile as unknown as { twoFactor?: { enabled?: boolean } }).twoFactor?.enabled}
            biometricConsent={(userProfile as unknown as { consents?: { biometric?: { given: boolean; at?: string | null; source?: string } } }).consents?.biometric || null}
            onChanged={refreshUserData}
          />
        )}
        {activeTab === "profile" && userProfile && <ProfileExtrasSection onChanged={refreshUserData} />}
        {activeTab === "profile" && userProfile && <NotificationsSection />}
        {activeTab === "profile" && userProfile && <ShopSection />}

        {activeTab === "bookings" && <BookingsSection />}

        {activeTab === "pt" && <PtSection />}

        {activeTab === "work" && work && <WorkSection initial={work} />}

        {activeTab === "checkin" && <CheckInSection />}

        {activeTab === "history" && (
          <HistorySection
            memberships={memberships}
            months={attendance?.months || []}
            loading={historyLoading}
            error={membershipError}
            selectedMonth={selectedMonth}
            // Picking a month loads it and moves to the tab that shows the
            // visits, so the click has somewhere to land.
            onSelectMonth={(key) => {
              selectMonth(key);
              handleTabChange("visits");
            }}
            onViewVisits={() => handleTabChange("visits")}
            onRefresh={fetchHistory}
          />
        )}

        {activeTab === "visits" && (
          <VisitsSection
            attendance={attendance}
            loading={historyLoading}
            error={visitsError}
            onRetry={fetchHistory}
            selectedMonth={selectedMonth}
            onSelectMonth={selectMonth}
            monthLoading={monthLoading}
          />
        )}
      </section>
    </main>
  );
};

const UserProfilePage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserProfilePageContent />
    </Suspense>
  );
};

export default UserProfilePage;
