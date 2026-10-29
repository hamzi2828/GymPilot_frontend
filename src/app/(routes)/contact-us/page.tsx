"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { contactService, ContactFormData, ContactTopic, ContactValidationErrors } from "./services/contactService";
import { useSiteSettings } from "@/components/ThemeProvider";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { DictKey } from "@/i18n/dictionaries";
import Spinner from "@/components/ui/Spinner";
import useAsyncAction from "@/components/ui/useAsyncAction";
import PageHero, { surfaceClass } from "@/components/site/PageHero";
import TiltCard from "@/components/site/TiltCard";
import Reveal from "@/components/site/Reveal";

// Each topic's button label, and the opening line offered for the message.
const TOPIC_TEXT: Record<ContactTopic, { label: DictKey; ask: DictKey }> = {
  membership: { label: "contact.topicMembership", ask: "contact.askMembership" },
  classes: { label: "contact.topicClasses", ask: "contact.askClasses" },
  "personal-training": { label: "contact.topicPt", ask: "contact.askPt" },
  billing: { label: "contact.topicBilling", ask: "contact.askBilling" },
  other: { label: "contact.topicOther", ask: "contact.askOther" },
};

const ContactUsPage = () => {
  // Phone and address come from admin settings, so they stay correct after a move.
  const { mobileNumber, contactEmail, address, maps, openingHours } = useSiteSettings();
  const { t } = useLanguage();

  const [formData, setFormData] = useState<ContactFormData>({
    fullName: '',
    emailAddress: '',
    phoneNumber: '',
    subject: '',
    message: '',
    category: 'other'
  });

  const [validationErrors, setValidationErrors] = useState<ContactValidationErrors>({});
  const { busy: isSubmitting, run } = useAsyncAction();
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const initialFormData: ContactFormData = {
    fullName: '',
    emailAddress: '',
    phoneNumber: '',
    subject: '',
    message: '',
    category: 'other'
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => sendMessage());
  };

  const sendMessage = async () => {
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
          // Matched without regard to case: "Email address is required" is
          // the email box's as much as "a valid email address" is.
          response.errors.forEach(error => {
            const said = error.toLowerCase();
            if (said.includes('name')) errors.fullName = error;
            else if (said.includes('email')) errors.emailAddress = error;
            else if (said.includes('phone')) errors.phoneNumber = error;
            else if (said.includes('subject')) errors.subject = error;
            else if (said.includes('message')) errors.message = error;
          });
          setValidationErrors(errors);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setSubmitStatus('error');
      setSubmitMessage('An unexpected error occurred. Please try again.');
    }
  };

  // Handle category change
  const handleCategoryChange = (category: ContactTopic) => {
    setFormData(prev => ({
      ...prev,
      category
    }));

    // Update message with suggestion if message is empty
    if (!formData.message.trim()) {
      const suggestion = t(TOPIC_TEXT[category].ask);
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

  const inputClass = (bad?: string | boolean) =>
    `w-full rounded-xl border bg-white/5 px-4 py-3 text-white placeholder-white/35 transition-colors focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] focus:border-[var(--accent)] ${
      bad ? "border-red-400/70 bg-red-500/10" : "border-white/15 hover:border-white/25"
    }`;
  const labelClass = "mb-2 block text-sm font-medium text-white/80";

  const contactCards = [
    mobileNumber
      ? { icon: Phone, label: "Call us", value: mobileNumber, href: `tel:${mobileNumber.replace(/\s+/g, "")}` }
      : null,
    contactEmail ? { icon: Mail, label: "Email us", value: contactEmail, href: `mailto:${contactEmail}` } : null,
    address ? { icon: MapPin, label: "Visit us", value: address, href: undefined } : null,
  ].filter((c): c is { icon: typeof Phone; label: string; value: string; href: string | undefined } => !!c);

  return (
    <main className="bg-[var(--base)] text-white">
      <PageHero
        title="Contact us"
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
        lead="Questions about memberships, classes or training? Send us a note and we will get back to you."
      />

      <section className={`${surfaceClass} px-4 pb-24 sm:px-6 lg:px-20`}>
        <div className="relative mx-auto max-w-[1280px]">
          {/* Status Messages */}
          {submitStatus === 'success' && (
            <div role="status" className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
              <CheckCircle2 size={20} aria-hidden="true" />
              <p className="font-medium">{submitMessage}</p>
            </div>
          )}

          {submitStatus === 'error' && (
            <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              <AlertCircle size={20} aria-hidden="true" />
              <p className="font-medium">{submitMessage}</p>
            </div>
          )}

          <div id="contact" className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Details */}
            <div className="space-y-4 lg:col-span-5">
              {contactCards.map(({ icon: Icon, label, value, href }, i) => (
                <Reveal key={label} delay={i * 0.06}>
                  <TiltCard max={5} className="rounded-2xl">
                    <div className="flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                      <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]" aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
                        {href ? (
                          <a
                            href={href}
                            {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                            className="mt-1 block break-words font-semibold text-white underline-offset-4 hover:text-[var(--accent)] hover:underline"
                          >
                            {value}
                          </a>
                        ) : (
                          <p className="mt-1 break-words font-semibold text-white">{value}</p>
                        )}
                        {label === "Visit us" && maps.placeUrl && (
                          <a href={maps.placeUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-[var(--accent)] underline-offset-4 hover:underline">
                            {t("contact.openMaps")}
                          </a>
                        )}
                      </div>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}

              {openingHours.length > 0 && (
                <Reveal>
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <Clock size={14} className="text-[var(--accent)]" aria-hidden="true" />
                      {t("contact.hours")}
                    </p>
                    <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-sm">
                      {openingHours.map((h) => (
                        <li key={h.day} className="flex justify-between gap-4 py-2">
                          <span className="text-white/75">{h.day}</span>
                          <span className={h.closed ? "text-[var(--text-muted)]" : "font-semibold text-white"}>
                            {h.closed ? t("contact.closed") : `${h.open} – ${h.close}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              )}

              <Reveal>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-sm leading-relaxed text-white/75">
                  <p>
                    <strong className="text-white">Memberships &amp; packages:</strong> Compare plans on the{" "}
                    <Link href="/packages" className="text-[var(--accent)] underline underline-offset-4 hover:no-underline">packages page</Link>
                    , or ask us here and we&apos;ll help you pick one.
                  </p>
                  <p className="mt-3">
                    <strong className="text-white">Classes &amp; timetable:</strong> Browse the full schedule under{" "}
                    <Link href="/classes" className="text-[var(--accent)] underline underline-offset-4 hover:no-underline">classes</Link>.
                  </p>
                  <p className="mt-3">
                    <strong className="text-white">{t("nav.trainers")}:</strong>{" "}
                    <Link href="/trainers" className="text-[var(--accent)] underline underline-offset-4 hover:no-underline">{t("contact.meetTeam")}</Link>
                  </p>
                  <p className="mt-3">
                    <strong className="text-white">Help:</strong>{" "}
                    <Link href="/faqs" className="text-[var(--accent)] underline underline-offset-4 hover:no-underline">FAQs</Link>
                    {" · "}
                    <Link href="/privacy-policy" className="text-[var(--accent)] underline underline-offset-4 hover:no-underline">Privacy</Link>
                  </p>
                </div>
              </Reveal>

              {maps.embedUrl && (
                <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
                  <iframe src={maps.embedUrl} title="Map" className="h-72 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                </div>
              )}
            </div>

            {/* Form */}
            <Reveal className="lg:col-span-7">
              <div className="relative overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface)] p-6 sm:p-8 lg:p-10">
                <div
                  className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
                  style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 65%)" }}
                  aria-hidden="true"
                />
                <h2 className="relative font-['Montserrat'] text-2xl font-extrabold text-white sm:text-3xl">Send us a message</h2>
                <p className="relative mt-2 text-sm text-[var(--text-muted)]">Fields marked * are required.</p>

                {/* Category Selection */}
                <fieldset className="relative mt-8">
                  <legend className={labelClass}>Category</legend>
                  <div className="flex flex-wrap gap-2">
                    {contactService.getContactCategories().map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        aria-pressed={formData.category === topic}
                        onClick={() => handleCategoryChange(topic)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                          formData.category === topic
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                            : 'border-white/15 bg-white/5 text-white/75 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {t(TOPIC_TEXT[topic].label)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <form onSubmit={handleSubmit} className="relative mt-6 space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fullName" className={labelClass}>Full Name *</label>
                      <input
                        type="text"
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="Enter your name"
                        className={inputClass(validationErrors.fullName)}
                        required
                      />
                      {validationErrors.fullName && (
                        <p className="mt-1 text-sm text-red-300">{validationErrors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="emailAddress" className={labelClass}>Email Address *</label>
                      <input
                        type="email"
                        id="emailAddress"
                        name="emailAddress"
                        value={formData.emailAddress}
                        onChange={handleInputChange}
                        placeholder="Enter your email"
                        className={inputClass(validationErrors.emailAddress)}
                        required
                      />
                      {validationErrors.emailAddress && (
                        <p className="mt-1 text-sm text-red-300">{validationErrors.emailAddress}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="phoneNumber" className={labelClass}>Phone Number</label>
                      <input
                        type="tel"
                        id="phoneNumber"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        placeholder={t("contact.phonePlaceholder")}
                        className={inputClass(validationErrors.phoneNumber)}
                      />
                      {validationErrors.phoneNumber && (
                        <p className="mt-1 text-sm text-red-300">{validationErrors.phoneNumber}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="subject" className={labelClass}>Subject</label>
                      <input
                        type="text"
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleInputChange}
                        placeholder="Brief description of your inquiry"
                        className={inputClass(validationErrors.subject)}
                      />
                      {validationErrors.subject && (
                        <p className="mt-1 text-sm text-red-300">{validationErrors.subject}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className={labelClass}>Message *</label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      rows={6}
                      placeholder="Please describe your query or concern..."
                      className={`${inputClass(validationErrors.message || messageCharCount.isOverLimit)} resize-none`}
                      required
                    />
                    <div className="mt-2 flex items-center justify-between">
                      {validationErrors.message ? (
                        <p className="text-sm text-red-300">{validationErrors.message}</p>
                      ) : (
                        <span></span>
                      )}
                      <span className={`text-sm ${messageCharCount.isOverLimit ? 'text-red-300' : 'text-[var(--text-muted)]'}`}>
                        {messageCharCount.count}/2000
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || messageCharCount.isOverLimit}
                    aria-busy={isSubmitting || undefined}
                    className="btn btn--primary btn--lg btn--block"
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner />
                        Submitting...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Send size={18} aria-hidden="true" />
                        Submit
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ContactUsPage;
