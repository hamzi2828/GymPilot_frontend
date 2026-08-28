import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ;

export interface PopularCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  message: string;
  data: T;
}

export const popularCategoriesService = {
  /**
   * Get all active categories for the popular categories section
   * Uses the existing /categories endpoint
   */
  async getPopularCategories(): Promise<PopularCategory[]> {
    try {
      const response = await axios.get<ApiResponse<PopularCategory[]>>(`${API_BASE_URL}/categories/public`);
      
      if (!response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch categories');
      }
      
      // Filter only active categories and return first 8 for popular categories
      const activeCategories = response.data.data
        .filter(category => category.active)
        .slice(0, 8); // Limit to 8 categories for the carousel
      
      return activeCategories;
    } catch (error) {
      console.error('Error fetching popular categories:', error);
      throw error;
    }
  },

  /**
   * Helper function to get category image with fallback
   */
  getCategoryImage(category: PopularCategory): string {
    // Priority: thumbnailUrl -> bannerUrl -> fallback
    const imageUrl = category.thumbnailUrl || category.bannerUrl;
    
    if (!imageUrl) {
      return '/images/gym-5.svg'; // fallback image
    }
    
    // If it's already a full URL, return as is
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    // Otherwise, prepend the backend URL
    return `${API_BASE_URL}${imageUrl}`;
  }
};

export default popularCategoriesService;