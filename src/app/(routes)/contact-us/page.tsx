"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import '@fortawesome/fontawesome-free/css/all.css';
import { contactService, ContactFormData, ContactValidationErrors } from "./services/contactService";

const ContactUsPage = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    fullName: '',
    emailAddress: '',
    phoneNumber: '',
    subject: '',
    message: '',
    category: 'general'
  });

  const [validationErrors, setValidationErrors] = useState<ContactValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const initialFormData: ContactFormData = {
    fullName: '',
    emailAddress: '',
    phoneNumber: '',
    subject: '',
    message: '',
    category: 'general'
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear validation error for this field
    if (validationErrors[name as keyof ContactValidationErrors]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }

    // Track unsaved changes
    setHasUnsavedChanges(true);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setValidationErrors({});

    try {
      const response = await contactService.submitContactForm(formData);

      if (response.success) {
        setSubmitStatus('success');
        setSubmitMessage(response.message);
        setFormData(initialFormData);
        setHasUnsavedChanges(false);

        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSubmitStatus('error');
        setSubmitMessage(response.message);

        if (response.errors) {
          const errors: ContactValidationErrors = {};
          response.errors.forEach(error => {
            if (error.includes('name')) errors.fullName = error;
            else if (error.includes('email')) errors.emailAddress = error;
            else if (error.includes('phone')) errors.phoneNumber = error;
            else if (error.includes('subject')) errors.subject = error;
            else if (error.includes('message')) errors.message = error;
          });
          setValidationErrors(errors);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setSubmitStatus('error');
      setSubmitMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({
      ...prev,
      category: category as ContactFormData['category']
    }));

    // Update message with suggestion if message is empty
    if (!formData.message.trim()) {
      const suggestion = contactService.getMessageSuggestion(category);
      setFormData(prev => ({
        ...prev,
        message: suggestion
      }));
    }

    setHasUnsavedChanges(true);
  };

  // Get character count for message
  const messageCharCount = contactService.getMessageCharacterCount(formData.message);

  // Warn user about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <main className="pt-24">
      <section className="bg-white sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            {/* Navigation Sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
              <nav className="bg-white rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-8">
                <Link href="/faqs" className="privacy-faq-nav-tab w-full px-6 py-4 text-left font-medium text-sm border-b border-gray-100 privacy-faq-nav-inactive block">
                  <i className="fas fa-question-circle mr-2"></i>
                  FAQS
                </Link>
                <Link href="/privacy-policy" className="privacy-faq-nav-tab w-full px-6 py-4 text-left font-medium text-sm border-b border-gray-100 privacy-faq-nav-inactive block">
                  <i className="fas fa-shield-alt mr-2"></i>
                  PRIVACY
                </Link>
                <Link href="/contact-us" className="privacy-faq-nav-tab w-full px-6 py-4 text-left font-medium text-sm privacy-faq-nav-active block">
                  <i className="fas fa-envelope mr-2"></i>
                  CONTACT US
                </Link>
              </nav>
            </aside>

            {/* Main Content */}
            <section className="flex-1">
              {/* Status Messages */}
              {submitStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <i className="fas fa-check-circle text-green-500 mr-3"></i>
                    <p className="text-green-800 font-medium">{submitMessage}</p>
                  </div>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
                    <p className="text-red-800 font-medium">{submitMessage}</p>
                  </div>
                </div>
              )}

              {/* Contact Content */}
              <div id="contact" className="privacy-faq-tab-content">
                <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8 lg:pt-0">
                  <header className="mb-8">
                    <h1 className="privacy-faq-title text-2xl lg:text-3xl mb-4">
                      CONTACT INFORMATION
                    </h1>
                    <div className="space-y-4 privacy-faq-subtitle">
                      <p>
                        <strong>For Exchanges and Returns:</strong> Read our
                        policy and apply for returns here:
                        <Link href="#" className="text-blue-600 hover:underline">
                          GYMWEAR RETURNS
                        </Link>
                      </p>
                      <p>
                        <strong>For Wholesale Enquiries:</strong> Please use
                        this form:
                        <Link href="#" className="text-blue-600 hover:underline">
                          GYMWEAR WHOLESALE
                        </Link>
                      </p>
                      <p>
                        <strong>For Other Queries:</strong> Email us at
                        support@gymwear.com
                      </p>
                      <p>
                        <strong>Live Chat:</strong> Available 9 AM to 6 PM Dubai
                        Time (GST), Monday to Friday
                      </p>
                      <p>
                        We typically reply within 24-48 hours on email. We
                        appreciate your patience.
                      </p>
                    </div>
                  </header>

                  <div className="bg-gray-50 rounded-lg p-6 lg:p-8">
                    <h2 className="privacy-faq-title text-xl mb-6">
                      FOR ALL OTHER QUERIES
                    </h2>

                    {/* Category Selection */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Category
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {contactService.getContactCategories().map((category) => (
                          <button
                            key={category.value}
                            type="button"
                            onClick={() => handleCategoryChange(category.value)}
                            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                              formData.category === category.value
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {category.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <label
                          htmlFor="fullName"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Full Name *
                        </label>
                        <input
                          type="text"
                          id="fullName"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          placeholder="Enter your name"
                          className={`privacy-faq-form-input w-full px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 ${
                            validationErrors.fullName ? 'border-red-300 bg-red-50' : ''
                          }`}
                          required
                        />
                        {validationErrors.fullName && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.fullName}</p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="emailAddress"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Email Address *
                        </label>
                        <input
                          type="email"
                          id="emailAddress"
                          name="emailAddress"
                          value={formData.emailAddress}
                          onChange={handleInputChange}
                          placeholder="Enter your email"
                          className={`privacy-faq-form-input w-full px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 ${
                            validationErrors.emailAddress ? 'border-red-300 bg-red-50' : ''
                          }`}
                          required
                        />
                        {validationErrors.emailAddress && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.emailAddress}</p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="phoneNumber"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          id="phoneNumber"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          placeholder="+92 987382 8967"
                          className={`privacy-faq-form-input w-full px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 ${
                            validationErrors.phoneNumber ? 'border-red-300 bg-red-50' : ''
                          }`}
                        />
                        {validationErrors.phoneNumber && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.phoneNumber}</p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="subject"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Subject
                        </label>
                        <input
                          type="text"
                          id="subject"
                          name="subject"
                          value={formData.subject}
                          onChange={handleInputChange}
                          placeholder="Brief description of your inquiry"
                          className={`privacy-faq-form-input w-full px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 ${
                            validationErrors.subject ? 'border-red-300 bg-red-50' : ''
                          }`}
                        />
                        {validationErrors.subject && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.subject}</p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="message"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Message *
                        </label>
                        <textarea
                          id="message"
                          name="message"
                          value={formData.message}
                          onChange={handleInputChange}
                          rows={6}
                          placeholder="Please describe your query or concern..."
                          className={`privacy-faq-form-input w-full px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 resize-none ${
                            validationErrors.message ? 'border-red-300 bg-red-50' : ''
                          } ${messageCharCount.isOverLimit ? 'border-red-300' : ''}`}
                          required
                        />
                        <div className="flex justify-between items-center mt-2">
                          {validationErrors.message ? (
                            <p className="text-sm text-red-600">{validationErrors.message}</p>
                          ) : (
                            <span></span>
                          )}
                          <span className={`text-sm ${
                            messageCharCount.isOverLimit ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {messageCharCount.count}/2000
                          </span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || messageCharCount.isOverLimit}
                        className={`privacy-faq-submit-btn inline-block w-full py-4 px-6 text-center text-white font-semibold rounded-lg transition-colors duration-300 hover:shadow-lg ${
                          isSubmitting || messageCharCount.isOverLimit
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                      >
                        {isSubmitting ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            SUBMITTING...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-paper-plane mr-2"></i>
                            SUBMIT
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ContactUsPage;
