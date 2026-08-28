"use client";

import React, { useState } from "react";
import Link from "next/link";
import '@fortawesome/fontawesome-free/css/all.css';

const FaqsPage = () => {
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
                <Link href="/faqs" className="privacy-faq-nav-tab w-full px-6 py-4 text-left font-medium text-sm border-b border-gray-100 privacy-faq-nav-active block">
                  <i className="fas fa-question-circle mr-2"></i>
                  FAQS
                </Link>
                <Link href="/privacy-policy" className="privacy-faq-nav-tab w-full px-6 py-4 text-left font-medium text-sm border-b border-gray-100 privacy-faq-nav-inactive block">
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
              {/* FAQ Content */}
              <div id="faqs" className="privacy-faq-tab-content">
                <div className="bg-white rounded-lg shadow-sm p-6 lg:p-8 lg:pt-0">
                  <header className="mb-8">
                    <h1 className="privacy-faq-title text-2xl lg:text-3xl mb-4">
                      FREQUENTLY ASKED QUESTIONS
                    </h1>
                    <div className="privacy-faq-question-border pb-6">
                      <h2 className="privacy-faq-title text-xl lg:text-2xl mb-2">
                        1. How Do I Shop?
                      </h2>
                      <p className="privacy-faq-subtitle">
                        Find out if we have already answered your query.
                      </p>
                    </div>
                  </header>

                  <div className="space-y-6">
                    {/* FAQ Item A */}
                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("answer-a")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          A. HOW DO I VIEW WHAT&apos;S IN MY SHOPPING CART?
                        </h3>
                        <i className={`fas ${expandedAnswers["answer-a"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["answer-a"] ? "" : "hidden"}`}
                      >
                        <p>
                          To view your cart contents, click the &quot;View Cart&quot; icon
                          in the upper-right corner. You can easily modify
                          quantities by updating the number and clicking &quot;Update
                          cart&quot;. Remove items by checking the &quot;Remove&quot; box next
                          to any item and updating your cart.
                        </p>
                      </div>
                    </article>

                    {/* FAQ Item B */}
                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("answer-b")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          B. HOW DO I ADD ITEMS TO MY CART?
                        </h3>
                        <i className={`fas ${expandedAnswers["answer-b"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["answer-b"] ? "" : "hidden"}`}
                      >
                        <p>
                          Browse our gymwear collection and click <span className="privacy-faq-link">Add to Cart</span>
                          on any product page. Select your size and quantity
                          before adding. Items will automatically appear in your
                          shopping cart.    
                        </p>
                      </div>
                    </article>

                    {/* FAQ Item C */}
                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("answer-c")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          C. HOW DO I REMOVE ITEMS FROM MY CART?
                        </h3>
                        <i className={`fas ${expandedAnswers["answer-c"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["answer-c"] ? "" : "hidden"}`}
                      >
                        <p>
                          In your cart, click <span className="privacy-faq-link">the Remove checkbox</span> next to any
                          item you want to delete, then click <span className="privacy-faq-link">Update cart</span> to
                          confirm the changes.
                        </p>
                      </div>
                    </article>

                    {/* FAQ Item D */}
                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("answer-d")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          D. HOW DO I CHANGE QUANTITY IN MY CART?
                        </h3>
                        <i className={`fas ${expandedAnswers["answer-d"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["answer-d"] ? "" : "hidden"}`}
                      >
                        <p>
                          Update the quantity field next to your item in the
                          cart and click <span className="privacy-faq-link">Update cart</span> to save changes. You can
                          increase or decrease quantities as needed.
                        </p>
                      </div>
                    </article>

                    {/* FAQ Item E */}
                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("answer-e")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          E. WHAT IF I ORDER SOMETHING OUT OF STOCK?
                        </h3>
                        <i className={`fas ${expandedAnswers["answer-e"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["answer-e"] ? "" : "hidden"}`}
                      >
                        <p>
                          We&apos;ll notify you immediately if an item becomes
                          unavailable. You can choose to wait for restock or
                          select an alternative gymwear item. Full refunds are
                          available if needed.
                        </p>
                      </div>
                    </article>

                    {/* FAQ Item F */}
                    <article className="privacy-faq-question-border pb-6">
                      <button
                        className="privacy-faq-accordion-btn w-full flex items-center justify-between text-left py-2"
                        onClick={() => toggleAnswer("answer-f")}
                      >
                        <h3 className="privacy-faq-title text-lg lg:text-xl">
                          F. WHERE CAN I FIND SIZING INFORMATION?
                        </h3>
                        <i className={`fas ${expandedAnswers["answer-f"] ? "fa-chevron-up" : "fa-chevron-down"} privacy-faq-accordion-icon text-gray-600`}></i>
                      </button>
                      <div
                        className={`privacy-faq-answer mt-4 text-base ${expandedAnswers["answer-f"] ? "" : "hidden"}`}
                      >
                        <p>
                          Each product page includes a detailed size chart.
                          Click <span className="privacy-faq-link">Size Guide</span> for measurements. We offer sizes
                          from XS to XXL for all our gymwear collections.
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

export default FaqsPage;
