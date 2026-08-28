"use client";

import React, { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { getUserDetailForProfile } from "../service/userDetailService";

export interface UserProfileShape {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: "male" | "female" | "other";
}

export interface ProfileSectionProps<T extends UserProfileShape> {
  userProfile: T | null;
  isEditing: boolean;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  setUserProfile: Dispatch<SetStateAction<T | null>>;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;

  // Parent-controlled save
  onSave: (
    payload: Pick<T, "firstName" | "lastName" | "email" | "phone" | "dateOfBirth" | "gender">
  ) => Promise<boolean>;
  isSaving: boolean;
}

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

// Ensure a safe YYYY-MM-DD string for <input type="date" />
function toDateInput(d?: string | null): string {
  if (!d) return new Date().toISOString().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const iso = new Date(d).toISOString();
  return iso.split("T")[0];
}

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
            merged.dateOfBirth = toDateInput(payload.dateOfBirth ?? prev.dateOfBirth);
            merged.gender = (payload.gender ?? prev.gender ?? "other") as T["gender"];
            merged.phone = payload.phone ?? prev.phone ?? "";
            return merged;
          });
        }
      } catch (e) {
        console.error("Error fetching user data:", e);
        showToast("Failed to load user data", "error");
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
      return new Date(userProfile.dateOfBirth).toLocaleDateString();
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
      showToast("First and last name are required", "error");
      return;
    }

    const ok = await onSave({
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      email: userProfile.email ?? "",
      phone: userProfile.phone ?? "",
      dateOfBirth: toDateInput(userProfile.dateOfBirth),
      gender: userProfile.gender ?? "other",
    } as Pick<T, "firstName" | "lastName" | "email" | "phone" | "dateOfBirth" | "gender">);

    if (ok) setIsEditing(false);
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
            onClick={() => setIsEditing((prev) => !prev)}
            className="px-4 py-2 border-2 border-primary text-primary font-semibold rounded-lg hover:bg-primary hover:text-black"
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
          value={isEditing ? toDateInput(userProfile?.dateOfBirth) : dobDisplay}
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
      </div>

      {isEditing && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
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
