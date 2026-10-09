import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// What the enquiry is about, in a gym's terms. The form offers these; the API
// still files a contact under its older list of categories, so each topic is
// sent as the nearest one of those and is also written into the subject,
// which is where the gym's staff read it. The label here is that subject
// wording; the page shows the visitor a translated one.
export type ContactTopic = 'membership' | 'classes' | 'personal-training' | 'billing' | 'other';

const CONTACT_TOPICS: { value: ContactTopic; label: string; apiCategory: 'general' | 'support' }[] = [
  { value: 'membership', label: 'Membership', apiCategory: 'general' },
  { value: 'classes', label: 'Classes', apiCategory: 'general' },
  { value: 'personal-training', label: 'Personal training', apiCategory: 'general' },
  { value: 'billing', label: 'Billing', apiCategory: 'support' },
  { value: 'other', label: 'Other', apiCategory: 'general' },
];

export interface ContactFormData {
  fullName: string;
  emailAddress: string;
  phoneNumber?: string;
  subject?: string;
  message: string;
  category?: ContactTopic;
}

export interface ContactSubmissionResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    fullName: string;
    emailAddress: string;
    subject: string;
    submittedAt: string;
  };
  errors?: string[];
}

export interface ContactValidationErrors {
  fullName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  subject?: string;
  message?: string;
}

// Validation functions
export const validateContactForm = (formData: ContactFormData): ContactValidationErrors => {
  const errors: ContactValidationErrors = {};

  // Full name validation
  if (!formData.fullName || formData.fullName.trim().length === 0) {
    errors.fullName = 'Full name is required';
  } else if (formData.fullName.trim().length > 100) {
    errors.fullName = 'Full name cannot exceed 100 characters';
  }

  // Email validation
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!formData.emailAddress || formData.emailAddress.trim().length === 0) {
    errors.emailAddress = 'Email address is required';
  } else if (!emailRegex.test(formData.emailAddress.trim())) {
    errors.emailAddress = 'Please enter a valid email address';
  }

  // Phone number validation (optional)
  if (formData.phoneNumber && formData.phoneNumber.trim().length > 20) {
    errors.phoneNumber = 'Phone number cannot exceed 20 characters';
  }

  // Subject validation (optional)
  if (formData.subject && formData.subject.trim().length > 200) {
    errors.subject = 'Subject cannot exceed 200 characters';
  }

  // Message validation
  if (!formData.message || formData.message.trim().length === 0) {
    errors.message = 'Message is required';
  } else if (formData.message.trim().length > 2000) {
    errors.message = 'Message cannot exceed 2000 characters';
  }

  return errors;
};

export const contactService = {
  // Submit contact form
  async submitContactForm(formData: ContactFormData): Promise<ContactSubmissionResponse> {
    try {
      // Validate form data
      const validationErrors = validateContactForm(formData);
      if (Object.keys(validationErrors).length > 0) {
        return {
          success: false,
          message: 'Please fix the validation errors',
          errors: Object.values(validationErrors)
        };
      }

      // Clean and prepare data
      const topic = CONTACT_TOPICS.find((t) => t.value === formData.category) || CONTACT_TOPICS[CONTACT_TOPICS.length - 1];
      const subject = formData.subject?.trim();
      const cleanData = {
        fullName: formData.fullName.trim(),
        emailAddress: formData.emailAddress.toLowerCase().trim(),
        phoneNumber: formData.phoneNumber?.trim(),
        // The topic leads the subject, e.g. "Billing: card charged twice".
        subject: (subject ? `${topic.label}: ${subject}` : topic.label).slice(0, 200),
        message: formData.message.trim(),
        category: topic.apiCategory
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/contact/submit`,
        cleanData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 seconds timeout
        }
      );

      return response.data;
    } catch (error: unknown) {
      console.error('Error submitting contact form:', error);

      // Handle different types of errors
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with error status
          return {
            success: false,
            message: error.response.data?.message || 'Failed to submit contact form',
            errors: error.response.data?.errors
          };
        } else if (error.request) {
          // Network error
          return {
            success: false,
            message: 'Network error. Please check your connection and try again.'
          };
        }
      }

      // Other error
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.'
      };
    }
  },

  // What the form's topic buttons offer
  getContactCategories(): ContactTopic[] {
    return CONTACT_TOPICS.map((topic) => topic.value);
  },

  // Format phone number (basic formatting)
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Format based on length
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    return phoneNumber; // Return original if no formatting rules match
  },

  // Sanitize input to prevent XSS
  sanitizeInput(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // Check if form data has changed (for unsaved changes warning)
  hasFormChanged(original: ContactFormData, current: ContactFormData): boolean {
    return (
      original.fullName !== current.fullName ||
      original.emailAddress !== current.emailAddress ||
      original.phoneNumber !== current.phoneNumber ||
      original.subject !== current.subject ||
      original.message !== current.message ||
      original.category !== current.category
    );
  },

  // Get character count for message field
  getMessageCharacterCount(message: string): { count: number; remaining: number; isOverLimit: boolean } {
    const count = message.length;
    const limit = 2000;
    const remaining = limit - count;

    return {
      count,
      remaining,
      isOverLimit: count > limit
    };
  }
};