import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface TrainerSocial {
  twitter?: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  linkedin?: string;
}

export interface Trainer {
  _id: string;
  name: string;
  slug?: string;
  role: string;
  bio?: string;
  image?: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  certifications?: string[];
  experience?: number;
  social?: TrainerSocial;
  isActive: boolean;
  isFeatured?: boolean;
  rating?: number;
  totalClasses?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrainersResponse {
  success: boolean;
  message: string;
  data: Trainer[];
}

export const trainerService = {
  /**
   * Get active trainers for the homepage
   * @param limit - Number of trainers to fetch (default: 4)
   */
  async getActiveTrainers(limit: number = 4): Promise<Trainer[]> {
    try {
      const response = await axios.get<TrainersResponse>(
        `${API_BASE_URL}/api/gymfolio/trainers/active?limit=${limit}&isFeatured=true`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch trainers');
      }

      // Transform the data to ensure consistent format
      return response.data.data.map(trainer => ({
        ...trainer,
        // Ensure image URL is absolute
        image: this.getAbsoluteImageUrl(trainer.image),
        // Ensure social links have proper format
        social: {
          twitter: trainer.social?.twitter || '',
          instagram: trainer.social?.instagram || '',
          facebook: trainer.social?.facebook || '',
          youtube: trainer.social?.youtube || '',
          linkedin: trainer.social?.linkedin || ''
        }
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching trainers:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch trainers');
      }
      throw error;
    }
  },

  /**
   * Get featured trainers for the homepage
   */
  async getFeaturedTrainers(): Promise<Trainer[]> {
    try {
      const response = await axios.get<TrainersResponse>(
        `${API_BASE_URL}/api/gymfolio/trainers/featured`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch featured trainers');
      }

      return response.data.data.map(trainer => ({
        ...trainer,
        image: this.getAbsoluteImageUrl(trainer.image),
        social: {
          twitter: trainer.social?.twitter || '',
          instagram: trainer.social?.instagram || '',
          facebook: trainer.social?.facebook || '',
          youtube: trainer.social?.youtube || '',
          linkedin: trainer.social?.linkedin || ''
        }
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching featured trainers:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch featured trainers');
      }
      throw error;
    }
  },

  /**
   * Get a single trainer by slug
   * @param slug - Trainer slug
   */
  async getTrainerBySlug(slug: string): Promise<Trainer> {
    try {
      const response = await axios.get<{ success: boolean; message: string; data: Trainer }>(
        `${API_BASE_URL}/api/gymfolio/trainers/slug/${slug}`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch trainer');
      }

      return {
        ...response.data.data,
        image: this.getAbsoluteImageUrl(response.data.data.image)
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching trainer:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch trainer');
      }
      throw error;
    }
  },

  /**
   * Helper function to convert relative image URLs to absolute URLs
   */
  getAbsoluteImageUrl(imageUrl?: string): string {
    if (!imageUrl) return '';

    // If already absolute URL, return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }

    // If relative URL, prepend backend URL
    const baseUrl = API_BASE_URL || 'http://localhost:4000';
    return `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  },

  /**
   * Format social media URL
   */
  formatSocialUrl(handle?: string, platform?: 'twitter' | 'instagram' | 'facebook' | 'youtube' | 'linkedin'): string {
    if (!handle || !platform) return '#';

    // If already a full URL, return it
    if (handle.startsWith('http://') || handle.startsWith('https://')) {
      return handle;
    }

    // Remove @ symbol if present
    const cleanHandle = handle.replace('@', '');

    // Return platform-specific URL
    const platformUrls = {
      twitter: `https://twitter.com/${cleanHandle}`,
      instagram: `https://instagram.com/${cleanHandle}`,
      facebook: `https://facebook.com/${cleanHandle}`,
      youtube: `https://youtube.com/@${cleanHandle}`,
      linkedin: `https://linkedin.com/in/${cleanHandle}`
    };

    return platformUrls[platform] || '#';
  }
};
