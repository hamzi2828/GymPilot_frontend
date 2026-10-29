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
import s from '../auth.module.css';

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
  // Only the form's content: AuthPage supplies the card and the column.
  return (
    <div>
      {/* Header */}
      <Header isSignUp={isSignUp} isForgot={isForgot} isReset={isReset} />

      {/* Outcome of the last submit. Replaces the alert() this page used to
          fire — which is how the old reset screen managed to announce success
          without ever having contacted the server. */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`${s.notice} ${notice.tone === "ok" ? s.noticeOk : s.noticeError}`}
        >
          {notice.text}
        </div>
      )}

      {/* A real form, so Enter in any box submits it (and password managers
          recognise it). noValidate: the messages under each box are ours, not
          the browser's bubbles. */}
      <form
        className={s.form}
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
            <p className={s.resetFor}>
              Setting a new password for <strong>{formData.email}</strong>
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
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
              label="New password"
              name="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={formData.password}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              error={errors?.password}
              handleInputChange={handleInputChange}
            />
            <ConfirmPasswordField
              label="Confirm new password"
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
            label="Confirm password"
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
  );
};


export default LeftSide;
