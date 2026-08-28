"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "./components/Header";
import { Tabs } from "./components/Tabs";
import { ProfileSection } from "./components/ProfileSection";
import { OrdersSection } from "./components/OrdersSection";
import { StatsSection } from "./components/StatsSection";
import { getUserDetailForProfile,updateUser, getUserOrders } from "./service/userDetailService";
import { getCurrentUser, UserPayload } from "@/helper/helper";

import {
  UserProfile,
  OrderStatus,
  statusStyles,
  Order
} from "./service/userDetailService";

// Accept backend-specific fields when hydrating from API
type BackendUserPayload = Partial<UserProfile> & {
  _id?: string;
  avatarUrl?: string | null;
};

const UserProfilePageContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"profile" | "orders">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [orderFilter, setOrderFilter] = useState("all");
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: "success" | "error" | "info" }>({
    show: false,
    msg: "",
    type: "success",
  });

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type }), 2500);
  };

  // Safely coerce incoming date to YYYY-MM-DD
  const toDateInput = (d?: string | null) => {
    if (!d) return new Date().toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const iso = new Date(d).toISOString();
    return iso.slice(0, 10);
  };

  // Fetch user orders
  const fetchOrders = async (): Promise<void> => {
    try {
      setOrdersLoading(true);
      const response = await getUserOrders({ limit: 50 }); // Get more orders initially
      if (response.success && response.orders) {
        setOrders(response.orders);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      showToast(error instanceof Error ? error.message : "Failed to fetch orders", "error");
    } finally {
      setOrdersLoading(false);
    }
  };

  // Fetch & merge user data from API/service
  const refreshUserData = async (): Promise<void> => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        router.replace("/authentication");
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
            dateOfBirth: toDateInput(),
            gender: "other",
            profileImage: "/default-avatar.png",
            joinedDate: new Date().toISOString(),
            totalOrders: 0,
            totalSpent: 0,
            loyaltyPoints: 0,
          } as UserProfile);

        return {
          ...base,
          ...pl,
          id: pl._id ?? pl.id ?? base.id,
          email: pl.email ?? base.email,
          firstName: pl.firstName ?? base.firstName,
          lastName: pl.lastName ?? base.lastName,
          phone: pl.phone ?? base.phone,
          gender: (pl.gender as UserProfile["gender"]) ?? base.gender,
          dateOfBirth: toDateInput(pl.dateOfBirth ?? base.dateOfBirth),
          profileImage: pl.avatarUrl ?? pl.profileImage ?? base.profileImage,
          joinedDate: pl.joinedDate ?? base.joinedDate,
          totalOrders: pl.totalOrders ?? base.totalOrders,
          totalSpent: pl.totalSpent ?? base.totalSpent,
          loyaltyPoints: pl.loyaltyPoints ?? base.loyaltyPoints,
        };
      });
    } catch (error) {
      console.error("Error refreshing user data:", error);
      showToast(error instanceof Error ? error.message : "Failed to refresh user data", "error");
    }
  };

  useEffect(() => {
    // Check URL parameters for tab
    const tab = searchParams.get('tab');
    if (tab === 'orders') {
      setActiveTab('orders');
    }
  }, [searchParams]);

  useEffect(() => {
    const u = getCurrentUser() as UserPayload | null;
    if (!u) {
      router.replace("/authentication");
      return;
    }
    // Seed with token data first
    setUserProfile({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: "",
      dateOfBirth: "",
      gender: "other",
      profileImage: "/images/gym1.svg",
      joinedDate: new Date().toISOString().slice(0, 10),
      totalOrders: 0,
      totalSpent: 0,
      loyaltyPoints: 0,
    });
    // Then hydrate from API
    refreshUserData();
    // Fetch orders
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const filteredOrders =
    orderFilter === "all" ? orders : orders.filter((o) => o.orderStatus === (orderFilter as OrderStatus));

  // Parent-owned save handler
  const handleSave = async (
    userData: Pick<UserProfile, "firstName" | "lastName" | "email" | "phone" | "dateOfBirth" | "gender">
  ) => {
    try {
      setSaving(true);

      if (!userData.firstName?.trim() || !userData.lastName?.trim()) {
        showToast("First and last name are required", "error");
        return false;
      }

      // Call updateUser service which already handles the response
      const result = await updateUser(userData);
      if (!result) {
        throw new Error("No data returned from server");
      }

      await refreshUserData();
      showToast("Profile updated successfully", "success");
      return true;
    } catch (e) {
      console.error("Update error:", e);
      showToast(e instanceof Error ? e.message : "Failed to update profile", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!userProfile) return null;

  return (
    <main className="pt-20 bg-white">
      <style jsx global>{`
        :root {
          --color-primary: #bee304;
        }
        .text-primary {
          color: var(--color-primary);
        }
        .bg-primary {
          background-color: var(--color-primary);
        }
        .border-primary {
          border-color: var(--color-primary);
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
        <Tabs activeTab={activeTab} onChange={setActiveTab} />

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

        {activeTab === "orders" && (
          <>
            {ordersLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-2 text-gray-500">Loading orders...</p>
                </div>
              </div>
            ) : (
              <OrdersSection
                filteredOrders={filteredOrders}
                orderFilter={orderFilter}
                setOrderFilter={setOrderFilter}
                statusStyles={statusStyles}
              />
            )}
          </>
        )}
      </section>

      <StatsSection
        joinedDate={userProfile.joinedDate}
        totalOrders={userProfile.totalOrders}
        totalSpent={userProfile.totalSpent}
        loyaltyPoints={userProfile.loyaltyPoints}
      />
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
