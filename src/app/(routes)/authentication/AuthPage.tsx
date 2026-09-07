"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LeftSide } from "./components/LeftSide";
import { RightSide } from "./components/RightSide";
import TwoFactorStep from "./components/TwoFactorStep";
import { signUp, login, requestPasswordReset, resetPassword, verifyTwoFactor } from "./service/authService";
import { setToken, setRole } from "@/helper/helper";
import type { Mode } from "./components/leftsSideComponents/types";

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
  // Where the emailed link lands. Distinct from `forgot`, which only asks for
  // the address.
  const [isReset, setIsReset] = useState(false);

  // The one-time token out of the reset link. Held in state rather than read
  // from the URL at submit time so that clearing the query string (below)
  // cannot strand a half-finished reset.
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Replaces the alert() this page used to fire. An alert was how the old
  // "reset" managed to claim success without ever calling the server; showing
  // outcomes inline keeps the message tied to the form that produced it.
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

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
  // A pending second step: the password was right, the emailed code is next.
  const [twoFactor, setTwoFactor] = useState<{ challengeId: string; message: string } | null>(null);

  // What happens once a token is in hand, whichever step produced it.
  const finishSignIn = (res: { token: string; data?: { role?: string } }) => {
    setToken(res.token);
    try {
      if (res?.data?.role) setRole(res.data.role);
    } catch {}
    const worksHere = !!res?.data?.role && res.data.role !== "user";
    router.replace(worksHere ? "/admin" : redirectTo || "/");
  };

  const verifyCode = async (code: string) => {
    if (!twoFactor) return;
    setIsLoading(true);
    setNotice(null);
    try {
      const res = await verifyTwoFactor({ challengeId: twoFactor.challengeId, code });
      finishSignIn(res);
    } catch (err: unknown) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Could not verify the code" });
    } finally {
      setIsLoading(false);
    }
  };
  type Errors = Partial<Record<
    | "firstName"
    | "lastName"
    | "email"
    | "password"
    | "confirmPassword",
    string
  >>;
  const [errors, setErrors] = useState<Errors>({});

  // Sync mode with URL query (?mode=signin|signup|forgot|reset)
  useEffect(() => {
    const mode = (searchParams.get("mode") || "signin").toLowerCase();
    const token = searchParams.get("token");

    // A link carrying a token is a reset regardless of what `mode` says, so a
    // truncated or hand-edited URL still lands somewhere that works.
    const onReset = mode === "reset" || !!token;

    setIsSignUp(mode === "signup");
    setIsForgot(mode === "forgot" && !onReset);
    setIsReset(onReset);

    if (token) {
      setResetToken(token);
      // Prefill so the person can see whose password they are changing.
      const emailFromLink = searchParams.get("email");
      if (emailFromLink) {
        setFormData((prev) => ({ ...prev, email: emailFromLink }));
      }
    }
  }, [searchParams]);

  const updateMode = (mode: Mode) => {
    setIsSignUp(mode === "signup");
    setIsForgot(mode === "forgot");
    setIsReset(mode === "reset");
    setNotice(null);
    setErrors({});
    // Carry `redirect` across mode switches, otherwise a buyer who taps
    // "Create an account" loses the checkout they were sent here from.
    const params = new URLSearchParams();
    if (mode !== "signin") params.set("mode", mode);
    if (redirectTo) params.set("redirect", redirectTo);
    const qs = params.toString();
    router.replace(`/authentication${qs ? `?${qs}` : ""}`);
    resetForm(false);
  };

  // One-tap fill for the demo-login buttons: drop a known-good email + password
  // into the form so a reviewer only has to press Sign In. Clears any stale
  // errors/notice from a previous attempt.
  const fillCredentials = (email: string, password: string) => {
    setFormData((prev) => ({ ...prev, email, password }));
    setErrors({});
    setNotice(null);
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
    setNotice(null);

    // Build field-level validation
    const newErrors: Errors = {};

    // Email is required everywhere except the reset screen, where the account
    // is identified by the token in the link rather than by anything typed.
    if (!isReset && !formData.email.trim()) newErrors.email = "Email is required";

    // 'forgot' collects an address and nothing else -- there is no password to
    // set until the person has proved they can read that mailbox.
    if (!isForgot && !formData.password.trim()) newErrors.password = "Password is required";

    if (isReset) {
      if (formData.password.trim() && formData.password.trim().length < 8) {
        newErrors.password = "Password must be at least 8 characters";
      }
      if (!formData.confirmPassword.trim()) {
        newErrors.confirmPassword = "Please confirm your new password";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

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
        await signUp(payload);
        updateMode("signin");
        setNotice({ tone: "ok", text: "Account created. You can sign in now." });
        return;
      }

      // Step one: ask for the email. The server answers the same way whether
      // or not the address is on file, so its message is shown as-is rather
      // than being replaced with a cheerier one that would leak the answer.
      if (isForgot) {
        const res = await requestPasswordReset(formData.email.trim());
        setNotice({
          tone: "ok",
          text: res?.message || "If that email address has an account, a reset link is on its way.",
        });
        return;
      }

      // Step two: the token from the emailed link, plus the new password.
      if (isReset) {
        if (!resetToken) {
          setNotice({
            tone: "error",
            text: "This reset link is incomplete. Please request a new one.",
          });
          return;
        }
        await resetPassword({ token: resetToken, password: formData.password });
        setResetToken(null);
        updateMode("signin");
        setNotice({
          tone: "ok",
          text: "Password updated. Sign in with your new password.",
        });
        return;
      }

      // Sign In flow
      const res = await login({ email: formData.email, password: formData.password });
      if (res.requires2fa && res.challengeId) {
        // Password accepted; the emailed code comes next.
        setTwoFactor({ challengeId: res.challengeId, message: res.message });
        return;
      }
      // Anyone who works here lands on the panel -- what they can actually
      // open there is decided by their role's permissions. Gym members
      // resume whatever they were doing (checkout, most often) or land on
      // the homepage.
      finishSignIn(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setNotice({ tone: "error", text: msg });
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
    setErrors({});
    if (clearMode) {
      setIsSignUp(false);
      setIsForgot(false);
      setIsReset(false);
      setResetToken(null);
      router.replace("/authentication");
    }
  };

  const toggleAuthMode = () => {
    // Only toggles between sign in and sign up; the two reset screens both
    // fall back to sign-in.
    if (isForgot || isReset) {
      updateMode("signin");
      return;
    }
    updateMode(isSignUp ? "signin" : "signup");
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Left Side - Auth Form, or the second step once a password is accepted */}
      {twoFactor ? (
        <TwoFactorStep
          message={twoFactor.message}
          onVerify={verifyCode}
          onBack={() => {
            setTwoFactor(null);
            setNotice(null);
          }}
          isLoading={isLoading}
          notice={notice}
        />
      ) : (
      <LeftSide
        isSignUp={isSignUp}
        isForgot={isForgot}
        isReset={isReset}
        notice={notice}
        formData={formData}
        handleInputChange={handleInputChange}
        fillCredentials={fillCredentials}
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
      )}

      <RightSide />

    </div>
  );
};

export default AuthPage;