"use client";

import React, { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FORGOT_PASSWORD_PATH, getUserDetailForProfile, SessionEndedError } from "../service/userDetailService";
import { toDateInputValue } from "@/helper/date";

export interface UserProfileShape {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // YYYY-MM-DD, or "" when not on file
  gender: "male" | "female" | "other";
  /** Issued by the gym for the phone app; not editable here. */
  username?: string;
}

/**
 * How a save went. A refusal comes back with the sentence to show beside the
 * form (a toast is gone in two seconds), `needsPassword` when the API wants
 * the current password for it, and `setPasswordFirst` when the account has
 * no password to give (it signs in with Google) and must set one first.
 */
export type SaveResult = { ok: true } | { ok: false; message: string; needsPassword?: boolean; setPasswordFirst?: boolean };

export interface ProfileSectionProps<T extends UserProfileShape> {
  userProfile: T | null;
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  setUserProfile: Dispatch<SetStateAction<T | null>>;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;

  // Parent-controlled save. The email travels in `change`, and only when it
  // was actually changed -- together with the current password the API asks
  // for. Everything else saves without one, so an account with no email can
  // still change its name and phone.
  onSave: (
    payload: Pick<T, "firstName" | "lastName" | "phone" | "dateOfBirth" | "gender">,
    change?: { email: string; currentPassword: string }
  ) => Promise<SaveResult>;
  isSaving: boolean;
}

// Two addresses that differ only in case or stray spaces are the same address.
const sameEmail = (a?: string | null, b?: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  editing,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  editing?: boolean;
}) => (
  <div>
    <label className="block text-sm font-semibold text-gray-900 mb-2">{label}</label>
    {editing ? (
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
      />
    ) : (
      <div className="w-full border-2 border-gray-100 rounded-lg px-4 py-3 bg-gray-50 text-gray-900">
        {value || "—"}
      </div>
    )}
  </div>
);

export function ProfileSection<T extends UserProfileShape>({
  userProfile,
  isEditing,
  setIsEditing,
  setUserProfile,
  showToast,
  onSave,
  isSaving,
}: ProfileSectionProps<T>) {
  const [loading, setLoading] = useState(true);
  // The profile as it was when Edit was pressed: what Cancel puts back, and
  // what the email box is compared with to know whether it was changed.
  const [beforeEdit, setBeforeEdit] = useState<T | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // Set when the API asked for the password although the email looked
  // unchanged from here.
  const [passwordAsked, setPasswordAsked] = useState(false);
  // The account has no password (it signs in with Google): the refusal is
  // shown with the way to set one.
  const [setPasswordFirst, setSetPasswordFirst] = useState(false);

  const startEditing = () => {
    setBeforeEdit(userProfile);
    setCurrentPassword("");
    setFormError(null);
    setPasswordAsked(false);
    setSetPasswordFirst(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    // Put back what was there: the boxes edit the profile in place, and a
    // cancelled edit used to stay on screen as if it had been saved.
    if (beforeEdit) setUserProfile(beforeEdit);
    setCurrentPassword("");
    setFormError(null);
    setPasswordAsked(false);
    setSetPasswordFirst(false);
    setIsEditing(false);
  };

  const emailChanged = isEditing && !!beforeEdit && !sameEmail(userProfile?.email, beforeEdit.email);
  const needsPassword = emailChanged || passwordAsked;

  // Initial fetch to hydrate profile (optional if parent already hydrated)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await getUserDetailForProfile();
        // Handle both { data: T } and direct T responses
        const payload = (resp && typeof resp === 'object' && 'data' in resp) 
          ? resp.data as Partial<T>
          : resp as Partial<T> | undefined;

        if (mounted && payload) {
          setUserProfile((prev) => {
            if (!prev) return payload as T;
            const merged = { ...prev, ...payload } as T;
            merged.dateOfBirth = toDateInputValue(payload.dateOfBirth ?? prev.dateOfBirth);
            merged.gender = (payload.gender ?? prev.gender ?? "other") as T["gender"];
            merged.phone = payload.phone ?? prev.phone ?? "";
            return merged;
          });
        }
      } catch (e) {
        // An ended session is already on its way to sign-in (the page).
        if (!(e instanceof SessionEndedError)) {
          console.error("Error fetching user data:", e);
          showToast("Failed to load user data", "error");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dobDisplay = useMemo(() => {
    if (!userProfile?.dateOfBirth) return '';
    try {
      // A date-only value parses as midnight UTC; read it back in UTC too, or
      // members west of Greenwich see the day before their birthday.
      return new Date(userProfile.dateOfBirth).toLocaleDateString(undefined, { timeZone: "UTC" });
    } catch {
      return userProfile.dateOfBirth;
    }
  }, [userProfile?.dateOfBirth]);

  const handleSaveClick = async () => {
    if (!userProfile) {
      showToast("User profile is not loaded", "error");
      return;
    }

    // lightweight client validation here if needed
    if (!userProfile.firstName?.trim() || !userProfile.lastName?.trim()) {
      setFormError("First and last name are required");
      return;
    }
    const typedEmail = (userProfile.email ?? "").trim();
    if (emailChanged && typedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail)) {
      setFormError("That email address does not look right. Check it and try again.");
      return;
    }
    // An empty password box is sent as it is: the API answers whether a
    // password is missing or the account has none to give, and only it knows.
    setFormError(null);
    setSetPasswordFirst(false);

    const result = await onSave(
      {
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        phone: userProfile.phone ?? "",
        // Blank stays blank (the API stores it as "no birthday"); defaulting to
        // today here used to save a fake birthday on any unrelated edit.
        dateOfBirth: toDateInputValue(userProfile.dateOfBirth),
        gender: userProfile.gender ?? "other",
      } as Pick<T, "firstName" | "lastName" | "phone" | "dateOfBirth" | "gender">,
      needsPassword ? { email: typedEmail, currentPassword } : undefined
    );

    if (result.ok) {
      setCurrentPassword("");
      setPasswordAsked(false);
      setIsEditing(false);
      return;
    }
    setFormError(result.message);
    if (result.needsPassword) setPasswordAsked(true);
    setSetPasswordFirst(!!result.setPasswordFirst);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-black">Personal Info</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={isEditing ? cancelEditing : startEditing}
            disabled={isSaving}
            className="px-4 py-2 border-2 border-primary text-primary font-semibold rounded-lg hover:bg-primary hover:text-black disabled:opacity-60"
          >
            <i className={`fas ${isEditing ? "fa-times" : "fa-edit"} mr-2`} />
            {isEditing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Field
          label="First Name"
          value={userProfile?.firstName ?? ""}
          editing={isEditing}
          onChange={(v) => setUserProfile((prev) => (prev ? { ...prev, firstName: v } : null) as T)}
        />
        <Field
          label="Last Name"
          value={userProfile?.lastName ?? ""}
          editing={isEditing}
          onChange={(v) => setUserProfile((prev) => (prev ? { ...prev, lastName: v } : null) as T)}
        />
        <Field
          label="Email"
          value={userProfile?.email ?? ""}
          editing={isEditing}
          onChange={(v) => setUserProfile((prev) => (prev ? { ...prev, email: v } : null) as T)}
          type="email"
        />
        <Field
          label="Phone"
          value={userProfile?.phone ?? ""}
          editing={isEditing}
          onChange={(v) => setUserProfile((prev) => (prev ? { ...prev, phone: v } : null) as T)}
          type="tel"
        />

        {/* Date of Birth */}
        <Field
          label="Date of Birth"
          value={isEditing ? toDateInputValue(userProfile?.dateOfBirth) : dobDisplay}
          editing={isEditing}
          onChange={(v) => setUserProfile((prev) => (prev ? { ...prev, dateOfBirth: v } : null) as T)}
          type={isEditing ? "date" : "text"}
        />

        {/* Gender */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Gender</label>
          {isEditing ? (
            <select
              value={userProfile?.gender || "other"}
              onChange={(e) =>
                setUserProfile((prev) => (prev ? { ...prev, gender: e.target.value as T["gender"] } : null) as T)
              }
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          ) : (
            <div className="w-full border-2 border-gray-100 rounded-lg px-4 py-3 bg-gray-50 text-gray-900 capitalize">
              {userProfile?.gender || "—"}
            </div>
          )}
        </div>

        {/* The gym issues this for the phone app. Read-only: staff reissue it
            from the admin panel if it ever needs to change. */}
        {userProfile?.username && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">App Username</label>
            <div className="w-full border-2 border-gray-100 rounded-lg px-4 py-3 bg-gray-50 text-gray-900 font-mono">
              {userProfile.username}
            </div>
            <p className="mt-1 text-xs text-gray-500">Use this to sign in to the app.</p>
          </div>
        )}
      </div>

      {/* Asked for only when the email is being added, changed or removed: it
          is where sign-in codes and password resets go, so the API wants
          proof it is still the member at the keyboard. */}
      {isEditing && needsPassword && (
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
          <label className="block text-sm font-semibold text-gray-900" htmlFor="profile-current-password">
            Current password
          </label>
          <p className="mt-1 text-sm text-gray-600">
            {!(userProfile?.email ?? "").trim()
              ? "You are removing your email address. Enter your current password to confirm it is you."
              : (beforeEdit?.email ?? "").trim()
                ? "You are changing your email address. Enter your current password to confirm it is you."
                : "You are adding an email address. Enter your current password to confirm it is you."}
          </p>
          <input
            id="profile-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-2 w-full max-w-sm border-2 border-gray-200 rounded-lg px-4 py-3 bg-white focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {isEditing && formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
          {setPasswordFirst && (
            <>
              {" "}
              <Link href={FORGOT_PASSWORD_PATH} className="font-semibold underline">
                Set a password
              </Link>
            </>
          )}
        </p>
      )}

      {isEditing && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={cancelEditing}
            className="px-5 py-3 border-2 border-gray-300 rounded-lg hover:border-gray-400 disabled:opacity-60"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            className="px-5 py-3 bg-primary text-black font-semibold rounded-lg hover:opacity-90 disabled:opacity-60"
            disabled={isSaving}
          >
            <i className="fas fa-save mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileSection;
