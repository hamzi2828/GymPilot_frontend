"use client";

import React, { useState } from "react";
import Link from "next/link";
import '@fortawesome/fontawesome-free/css/all.css';

const PrivacyPage = () => {
  const [expandedAnswers, setExpandedAnswers] = useState<Record<string, boolean>>({});

  const toggleAnswer = (answerId: string) => {
    setExpandedAnswers(prev => ({
      ...prev,
      [answerId]: !prev[answerId]
    }));
  };

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
                <Link href="/privacy-policy" className="privacy-faq-nav-tab w-full px-6 py-4 text-left font-medium text-sm border-b border-gray-100 privacy-faq-nav-active block">
                  <i className="fas fa-shield-alt mr-2"></i>
                  PRIVACY
                </Link>
                <Link href="/contact-us" className="privacy-faq-nav-tab w-full px-6 py-4 text-left font-medium text-sm privacy-faq-nav-inactive block">
                  <i className="fas fa-envelope mr-2"></i>
                  CONTACT US
                </Link>
              </nav>
            </aside>

            {/* Main Content */}
            <section className="flex-1">
              {/* Privacy Content */}
              <div id="privacy" className="privacy-faq-tab-content">
                <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8 lg:pt-0">
                  <header className="mb-8">
                    <h1 className="privacy-faq-title text-2xl lg:text-3xl mb-4">
                      PRIVACY POLICY
                    </h1>
                    <p className="privacy-faq-subtitle">
                      Your privacy and data protection information.
                    </p>
                  </header>

                  <div className="space-y-6">
                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("privacy-a")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          DATA COLLECTION
                        </h3>
                        <i className={`fas ${expandedAnswers["privacy-a"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["privacy-a"] ? "" : "hidden"}`}
                      >
                        <p>
                          We collect minimal personal data necessary for order
                          processing and delivery. This includes name, address,
                          email, and payment information securely encrypted.
                        </p>
                      </div>
                    </article>

                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("privacy-b")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          COOKIE USAGE
                        </h3>
                        <i className={`fas ${expandedAnswers["privacy-b"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["privacy-b"] ? "" : "hidden"}`}
                      >
                        <p>
                          We use essential cookies for cart functionality and
                          optional cookies for analytics. You can manage cookie
                          preferences in your browser settings.
                        </p>
                      </div>
                    </article>

                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("privacy-c")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          DATA SHARING
                        </h3>
                        <i className={`fas ${expandedAnswers["privacy-c"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["privacy-c"] ? "" : "hidden"}`}
                      >
                        <p>
                          We never sell your personal data. Information is only
                          shared with trusted delivery partners and payment
                          processors to fulfill your orders.
                        </p>
                      </div>
                    </article>
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

export default PrivacyPage;
