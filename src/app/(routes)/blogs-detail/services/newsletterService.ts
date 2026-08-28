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
        throw new Error(data.message || 'Failed to subscribe to newsletter');
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

  validateEmail(email: string): boolean {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
  }
}

// Export a singleton instance
export const newsletterService = new NewsletterService();