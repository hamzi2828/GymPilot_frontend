"use client";
import React, { useState, FormEvent } from 'react';
import { registrationService } from '../../packages/services/registrationService';
import { ContactContent, DEFAULT_CONTACT } from '../services/homeService';
import { AccentText, Reveal } from './SectionHeading';

interface FormData {
  username: string;
  phone: string;
  email: string;
}

const ContactSection = ({ content = DEFAULT_CONTACT }: { content?: ContactContent }) => {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    phone: '',
    email: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Clear previous messages
    setSuccessMessage('');
    setErrorMessage('');

    // Simple validation
    if (!formData.username || !formData.phone || !formData.email) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      await registrationService.submitRegistration({
        ...formData,
        platform: 'gymfolio'
      });

      setSuccessMessage('Thank you! Your registration has been submitted successfully. We will contact you soon.');
      setFormData({
        username: '',
        phone: '',
        email: ''
      });
    } catch (error) {
      console.error('Registration submission error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.parentElement?.classList.add('gymfolio8-focused');
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.parentElement?.classList.remove('gymfolio8-focused');
  };

  return (
    <section className="gymfolio8-contact-bg py-16 lg:py-20 px-4 sm:px-8 lg:px-20 relative overflow-hidden">
      {/* Background Image */}
      <div className="gymfolio8-bg-image absolute right-0 top-0 w-[720px] h-[642px]  hidden xl:block"></div>

      <div className=" mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-32 items-center">
          {/* Left Side - Content */}
          <Reveal className="lg:pr-8">
            <div className="space-y-8 lg:space-y-16">
              <header className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="home-eyebrow-dot" aria-hidden="true"></span>
                    <span className="home-eyebrow-label">{content.badge}</span>
                  </div>

                  <h2 className="home-section-title text-2xl sm:text-3xl lg:text-4xl text-black">
                    <AccentText text={content.heading} />
                  </h2>
                </div>

                <p className="home-section-description text-sm leading-6">{content.description}</p>
              </header>
            </div>
          </Reveal>

          {/* Right Side - Form */}
          <Reveal delay={120} className="lg:min-w-[520px] lg:ml-auto">
            <div className="gymfolio8-form-container rounded-3xl p-8 lg:p-12">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <header className="mb-6">
                  <h2 className="gymfolio8-form-text gymfolio8-font-montserrat font-bold text-2xl lg:text-3xl leading-tight tracking-tight">
                    {content.formTitle}
                  </h2>
                </header>

                <div className="space-y-4">
                  {/* Username Field */}
                  <div className="gymfolio8-form-field">
                    <label
                      htmlFor="username"
                      className="block gymfolio8-form-text gymfolio8-font-poppins font-medium text-sm leading-6 mb-1.5"
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      placeholder="Username"
                      value={formData.username}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      className="gymfolio8-form-input w-full px-3.5 py-2.5 rounded-lg gymfolio8-gray-text gymfolio8-font-poppins text-sm leading-6 placeholder:gymfolio8-gray-text"
                      required
                    />
                  </div>

                  {/* Phone Number Field */}
                  <div className="gymfolio8-form-field">
                    <label
                      htmlFor="phone"
                      className="block gymfolio8-form-text gymfolio8-font-poppins font-medium text-sm leading-6 mb-1.5"
                    >
                      Phone number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      className="gymfolio8-form-input w-full px-3.5 py-2.5 rounded-lg gymfolio8-gray-text gymfolio8-font-poppins text-sm leading-6 placeholder:gymfolio8-gray-text"
                      required
                    />
                  </div>

                  {/* Email Field */}
                  <div className="gymfolio8-form-field">
                    <label
                      htmlFor="email"
                      className="block gymfolio8-form-text gymfolio8-font-poppins font-medium text-sm leading-6 mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="bac124@mail.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      className="gymfolio8-form-input w-full px-3.5 py-2.5 rounded-lg gymfolio8-gray-text gymfolio8-font-poppins text-sm leading-6 placeholder:gymfolio8-gray-text"
                      required
                    />
                  </div>
                </div>

                {/* Success Message */}
                {successMessage && (
                  <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                    <p className="text-green-800 text-sm">{successMessage}</p>
                  </div>
                )}

                {/* Error Message */}
                {errorMessage && (
                  <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                    <p className="text-red-800 text-sm">{errorMessage}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="gymfolio8-contact-button w-full px-6 py-3 rounded-lg flex items-center justify-center gap-2 gymfolio8-font-manrope font-semibold text-sm leading-5 text-black"
                >
                  <span>{isSubmitting ? 'Submitting...' : content.buttonText}</span>
                  {!isSubmitting && (
                    <svg
                      className="gymfolio8-arrow-icon w-6 h-6"
                      viewBox="0 0 34 34"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M14.4263 10.9897L23.0105 10.9897L23.0105 19.574"
                        stroke="black"
                        strokeWidth="1.5"
                        strokeMiterlimit="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10.9897 23.0103L22.8904 11.1096"
                        stroke="black"
                        strokeWidth="1.5"
                        strokeMiterlimit="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;