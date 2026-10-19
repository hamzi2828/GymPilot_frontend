import { looksLikeEmail } from '@/helper/email';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface NewsletterSubscription {
  email: string;
  subscribedAt: string;
}

export interface NewsletterResponse {
  success: boolean;
  message: string;
  data?: NewsletterSubscription;
}

class NewsletterService {
  async subscribe(email: string, source: string = 'blog'): Promise<NewsletterResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          source
        }),
      });

      const data: NewsletterResponse = await response.json();

      if (!response.ok) {
        // The status travels with the error: 409 means the address is already
        // on the list, which a form words differently from a failure.
        throw Object.assign(new Error(data.message || 'Failed to subscribe to newsletter'), { status: response.status });
      }

      return data;
    } catch (error) {
      console.error('Error subscribing to newsletter:', error);
      throw error;
    }
  }

  async unsubscribe(email: string): Promise<NewsletterResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/newsletter/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim()
        }),
      });

      const data: NewsletterResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unsubscribe from newsletter');
      }

      return data;
    } catch (error) {
      console.error('Error unsubscribing from newsletter:', error);
      throw error;
    }
  }

  // The API's rule (helper/email.ts): any last part of two or more letters,
  // so jane@gym.info is not turned away here.
  validateEmail(email: string): boolean {
    return looksLikeEmail(email);
  }
}

// Export a singleton instance
export const newsletterService = new NewsletterService();