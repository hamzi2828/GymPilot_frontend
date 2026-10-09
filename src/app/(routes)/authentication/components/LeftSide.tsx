import React from 'react';
import {
  Header,
  NameFields,
  EmailField,
  PasswordField,
  ConfirmPasswordField,
  SignInUtilities,
  TermsCheckbox,
  CTAButton,
  FooterToggle,
  DemoAccounts,
} from './leftsSideComponents';

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
  acceptTerms: boolean;
};

type LeftSideProps = {
  isSignUp: boolean;
  isForgot: boolean;
  /** The screen the emailed reset link lands on. */
  isReset?: boolean;
  /** Result of the last submit, shown above the form. */
  notice?: { tone: "ok" | "error"; text: string } | null;
  formData: FormData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Fills the email + password fields from a demo-login button. */
  fillCredentials: (email: string, password: string) => void;
  handleSubmit: () => void;
  updateMode: (mode: "signin" | "signup" | "forgot" | "reset") => void;
  toggleAuthMode: () => void;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (show: boolean) => void;
  termsError?: string | null;
  errors?: Partial<Record<
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'password'
    | 'confirmPassword',
    string
  >>;
};

export const LeftSide: React.FC<LeftSideProps> = ({
  isSignUp,
  isForgot,
  isReset = false,
  notice = null,
  formData,
  handleInputChange,
  fillCredentials,
  handleSubmit,
  updateMode,
  toggleAuthMode,
  isLoading,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  termsError,
  errors,
}) => {
  return (
    <div className="flex-1 flex items-center justify-center px-8 py-6 relative">
    {/* Subtle background pattern */}
    <div className="absolute inset-0 opacity-5">
      <div
        className="h-full w-full"
        style={{
          backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="10" cy="10" r="1" fill="%23ff6b2c"/><circle cx="90" cy="90" r="1" fill="%23ff6b2c"/><circle cx="10" cy="90" r="1" fill="%23ff6b2c"/><circle cx="90" cy="10" r="1" fill="%23ff6b2c"/></svg>')`,
          backgroundSize: "50px 50px",
        }}
      ></div>
    </div>

    <div className="w-full max-w-md space-y-8 relative z-10">
      {/* Header */}
      <Header isSignUp={isSignUp} isForgot={isForgot} isReset={isReset} />

      {/* Outcome of the last submit. Replaces the alert() this page used to
          fire — which is how the old reset screen managed to announce success
          without ever having contacted the server. */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-2xl px-5 py-4 text-sm font-medium border ${
            notice.tone === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* A real form, so Enter in any box submits it (and password managers
          recognise it). noValidate: the messages under each box are ours, not
          the browser's bubbles. */}
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!isLoading) handleSubmit();
        }}
      >
        <NameFields
          isSignUp={isSignUp}
          formData={formData}
          errors={errors}
          handleInputChange={handleInputChange}
        />

        {/* On the reset screen the account is identified by the token in the
            link, so the address is shown for reassurance but cannot be edited
            — typing a different one here would not change whose password is
            about to be set. */}
        {isReset ? (
          formData.email ? (
            <p className="text-sm text-gray-600 font-medium text-center">
              Setting a new password for{" "}
              <span className="font-black text-gray-900">{formData.email}</span>
            </p>
          ) : null
        ) : (
          <EmailField
            formData={formData}
            errors={errors}
            handleInputChange={handleInputChange}
            allowUsername={!isSignUp && !isForgot}
          />
        )}

        {/* 'forgot' asks for the address and nothing else: there is no password
            to set until the person has proved they can read that mailbox. */}
        {!isForgot && !isReset && (
          <PasswordField
            label="Password"
            name="password"
            placeholder={isSignUp ? 'At least 8 characters' : 'Enter password'}
            value={formData.password}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            error={errors?.password}
            handleInputChange={handleInputChange}
          />
        )}

        {isReset && (
          <>
            <PasswordField
              label="New Password"
              name="password"
              placeholder="At least 8 characters"
              value={formData.password}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              error={errors?.password}
              handleInputChange={handleInputChange}
            />
            <ConfirmPasswordField
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={formData.confirmPassword}
              showConfirmPassword={showConfirmPassword}
              setShowConfirmPassword={setShowConfirmPassword}
              error={errors?.confirmPassword}
              handleInputChange={handleInputChange}
            />
          </>
        )}

        {isSignUp && (
          <ConfirmPasswordField
            label="Confirm Password"
            placeholder="Confirm password"
            value={formData.confirmPassword}
            showConfirmPassword={showConfirmPassword}
            setShowConfirmPassword={setShowConfirmPassword}
            error={errors?.confirmPassword}
            handleInputChange={handleInputChange}
          />
        )}

        <SignInUtilities
          isSignUp={isSignUp}
          isForgot={isForgot}
          isReset={isReset}
          rememberMe={formData.rememberMe}
          handleInputChange={handleInputChange}
          updateMode={updateMode}
        />

        <TermsCheckbox
          isSignUp={isSignUp}
          acceptTerms={formData.acceptTerms}
          handleInputChange={handleInputChange}
          termsError={termsError}
        />

        <DemoAccounts
          show={!isSignUp && !isForgot && !isReset}
          fillCredentials={fillCredentials}
        />

        <CTAButton
          isLoading={isLoading}
          isSignUp={isSignUp}
          isForgot={isForgot}
          isReset={isReset}
        />

        <FooterToggle
          isSignUp={isSignUp}
          isForgot={isForgot}
          isReset={isReset}
          toggleAuthMode={toggleAuthMode}
          updateMode={updateMode}
        />
      </form>
    </div>
  </div>
)}


export default LeftSide;
