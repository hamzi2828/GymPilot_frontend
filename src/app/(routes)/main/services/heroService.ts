import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface HeroSlide {
  _id: string;
  title: string;
  description: string;
  imageUrl: string;
  buttonText?: string;
  buttonLink?: string;
  secondButtonText?: string;
  secondButtonLink?: string;
  isActive: boolean;
  order: number;
  ariaLabel?: string;
  platform: 'gymfolio';
  createdAt: string;
  updatedAt: string;
}

export interface HeroSlideInput {
  title: string;
  description: string;
  buttonText?: string;
  buttonLink?: string;
  secondButtonText?: string;
  secondButtonLink?: string;
  isActive?: boolean;
  order?: number;
  ariaLabel?: string;
  platform?: 'gymfolio';
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const heroService = {
  /**
   * Get all active hero slides for gymfolio platform
   */
  async getActiveSlides(): Promise<HeroSlide[]> {
    try {
      const response = await axios.get<ApiResponse<HeroSlide[]>>(`${API_BASE_URL}/hero-slides/active`, {
        params: { platform: 'gymfolio' }
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch hero slides');
      }

      return response.data.data;
    } catch (error) {
      console.error('Error fetching active hero slides:', error);
      throw error;
    }
  },

  /**
   * Get all hero slides (admin only)
   */
  async getAllSlides(): Promise<HeroSlide[]> {
    try {
      const response = await axios.get<ApiResponse<HeroSlide[]>>(`${API_BASE_URL}/hero-slides`, {
        headers: getAuthHeader(),
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch hero slides');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching all hero slides:', error);
      throw error;
    }
  },

  /**
   * Get single hero slide by ID
   */
  async getSlideById(id: string): Promise<HeroSlide> {
    try {
      const response = await axios.get<ApiResponse<HeroSlide>>(`${API_BASE_URL}/hero-slides/${id}`, {
        headers: getAuthHeader(),
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch hero slide');
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching hero slide ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create new hero slide
   */
  async createSlide(formData: FormData): Promise<HeroSlide> {
    try {
      const response = await axios.post<ApiResponse<HeroSlide>>(
        `${API_BASE_URL}/hero-slides`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create hero slide');
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Error creating hero slide:', error);
      throw error;
    }
  },

  /**
   * Update hero slide
   */
  async updateSlide(id: string, formData: FormData): Promise<HeroSlide> {
    try {
      const response = await axios.put<ApiResponse<HeroSlide>>(
        `${API_BASE_URL}/hero-slides/${id}`,
        formData,
        {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update hero slide');
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`Error updating hero slide ${id}:`, error);
      throw error;
    }
  },

  /**
   * Toggle hero slide active status
   */
  async toggleSlideStatus(id: string, isActive: boolean): Promise<HeroSlide> {
    try {
      const response = await axios.patch<ApiResponse<HeroSlide>>(
        `${API_BASE_URL}/hero-slides/${id}/status`,
        { isActive },
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update hero slide status');
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`Error updating hero slide status ${id}:`, error);
      throw error;
    }
  },

  /**
   * Update hero slide order
   */
  async updateSlideOrder(id: string, order: number): Promise<HeroSlide> {
    try {
      const response = await axios.patch<ApiResponse<HeroSlide>>(
        `${API_BASE_URL}/hero-slides/${id}/order`,
        { order },
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update hero slide order');
      }
      
      return response.data.data;
    } catch (error) {
      console.error(`Error updating hero slide order ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete hero slide
   */
  async deleteSlide(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.delete<ApiResponse<null>>(`${API_BASE_URL}/hero-slides/${id}`, {
        headers: getAuthHeader(),
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete hero slide');
      }
      
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error(`Error deleting hero slide ${id}:`, error);
      throw error;
    }
  },
};

export default heroService;