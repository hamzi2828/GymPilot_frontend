"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LeftSide } from "./components/LeftSide";
import { RightSide } from "./components/RightSide";
import { signUp, login } from "./service/authService";
import { setToken, setRole } from "@/helper/helper";

/**
 * Only same-origin paths are honoured. Anything else — a protocol-relative
 * `//evil.com`, an absolute URL, a non-path value — is discarded so the
 * `?redirect=` param can't be used to bounce users off the site.
 */
const safeRedirect = (value: string | null): string | null => {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
};

const AuthPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Where to land after a successful sign-in. Checkout sends buyers here when
  // they aren't logged in, so dropping this param strands them on the homepage
  // mid-purchase.
  const redirectTo = safeRedirect(searchParams.get("redirect"));

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    rememberMe: false,
    acceptTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  type Errors = Partial<Record<
    | "firstName"
    | "lastName"
    | "email"
    | "password"
    | "confirmPassword",
    string
  >>;
  const [errors, setErrors] = useState<Errors>({});

  // Sync mode with URL query (?mode=signin|signup|forgot)
  useEffect(() => {
    const mode = (searchParams.get("mode") || "signin").toLowerCase();
    setIsSignUp(mode === "signup");
    setIsForgot(mode === "forgot");
  }, [searchParams]);

  const updateMode = (mode: "signin" | "signup" | "forgot") => {
    setIsSignUp(mode === "signup");
    setIsForgot(mode === "forgot");
    // Carry `redirect` across mode switches, otherwise a buyer who taps
    // "Create an account" loses the checkout they were sent here from.
    const params = new URLSearchParams();
    if (mode !== "signin") params.set("mode", mode);
    if (redirectTo) params.set("redirect", redirectTo);
    const qs = params.toString();
    router.replace(`/authentication${qs ? `?${qs}` : ""}`);
    resetForm(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // clear field-specific error when user edits
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    // clear terms error if user toggles checkbox
    if (name === "acceptTerms") setTermsError(null);
  };

  const handleSubmit = async () => {
    // Build field-level validation
    const newErrors: Errors = {};
    // Required for all modes: email
    if (!formData.email.trim()) newErrors.email = "Email is required";
    // Password required except when mode is plain signin? Current UI requires password when not forgot
    if (!isForgot && !formData.password.trim()) newErrors.password = "Password is required";
    // Sign Up specific
    if (isSignUp) {
      if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
      if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
      if (!formData.confirmPassword.trim()) newErrors.confirmPassword = "Confirm password is required";
      if (
        formData.password.trim() &&
        formData.confirmPassword.trim() &&
        formData.password !== formData.confirmPassword
      ) {
        newErrors.confirmPassword = "Passwords do not match";
      }
      if (!formData.acceptTerms) {
        setTermsError("Please accept the terms and conditions");
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0 || (isSignUp && !formData.acceptTerms)) {
      return;
    }

    // clear any previous terms error on valid attempt
    setTermsError(null);
    setIsLoading(true);
    try {
      if (isSignUp) {
        const payload = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email,
          password: formData.password,
        };
        const res = await signUp(payload);
        console.log("Sign Up Response:", res);
        alert("Account created successfully. Please sign in.");
        updateMode("signin");
        return;
      }

      const action = isForgot ? "Reset Password" : "Sign In";
      console.log(`${action} Form Data:`, formData);
      if (isForgot) {
        alert("Password reset successful. Please sign in with your new password.");
        updateMode("signin");
      } else {
        // Sign In flow
        const res = await login({ email: formData.email, password: formData.password });
        setToken(res.token);
        try {
          if (res?.data?.role) {
            // Persist role for middleware and client guards
            setRole(res.data.role);
          }
        } catch {}
        // Admins go to the dashboard; everyone else resumes whatever they were
        // doing (checkout, most often) or lands on the homepage.
        const destination =
          res?.data?.role === "admin" ? "/admin" : redirectTo || "/";
        router.replace(destination);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = (clearMode = true) => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      rememberMe: false,
      acceptTerms: false,
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (clearMode) {
      setIsSignUp(false);
      setIsForgot(false);
      router.replace("/authentication");
    }
  };

  const toggleAuthMode = () => {
    // Only toggles between sign in and sign up
    if (isForgot) {
      updateMode("signin");
      return;
    }
    updateMode(isSignUp ? "signin" : "signup");
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Left Side - Auth Form */}
      <LeftSide 
        isSignUp={isSignUp}
        isForgot={isForgot}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        updateMode={updateMode}
        toggleAuthMode={toggleAuthMode}
        isLoading={isLoading}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        showConfirmPassword={showConfirmPassword}
        setShowConfirmPassword={setShowConfirmPassword}
        termsError={termsError}
        errors={errors}
      />

      <RightSide />

    </div>
  );
};

export default AuthPage;