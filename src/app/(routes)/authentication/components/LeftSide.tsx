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
  formData: FormData;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: () => void;
  updateMode: (mode: "signin" | "signup" | "forgot") => void;
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
  formData,
  handleInputChange,
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
          backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="10" cy="10" r="1" fill="%23bee304"/><circle cx="90" cy="90" r="1" fill="%23bee304"/><circle cx="10" cy="90" r="1" fill="%23bee304"/><circle cx="90" cy="10" r="1" fill="%23bee304"/></svg>')`,
          backgroundSize: "50px 50px",
        }}
      ></div>
    </div>

    <div className="w-full max-w-md space-y-8 relative z-10">
      {/* Header */}
      <Header isSignUp={isSignUp} isForgot={isForgot} />

      {/* Form */}
      <div className="space-y-5">
        <NameFields
          isSignUp={isSignUp}
          formData={formData}
          errors={errors}
          handleInputChange={handleInputChange}
        />

        <EmailField
          formData={formData}
          errors={errors}
          handleInputChange={handleInputChange}
        />

        {!isForgot && (
          <PasswordField
            label="Password"
            name="password"
            placeholder={isSignUp ? 'Create password' : 'Enter password'}
            value={formData.password}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            error={errors?.password}
            handleInputChange={handleInputChange}
          />
        )}

        {isForgot && (
          <>
            <PasswordField
              label="New Password"
              placeholder="Enter new password"
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

        <CTAButton
          isLoading={isLoading}
          isSignUp={isSignUp}
          isForgot={isForgot}
          handleSubmit={handleSubmit}
        />

        <FooterToggle
          isSignUp={isSignUp}
          isForgot={isForgot}
          toggleAuthMode={toggleAuthMode}
          updateMode={updateMode}
        />
      </div>
    </div>
  </div>
)}


export default LeftSide;
