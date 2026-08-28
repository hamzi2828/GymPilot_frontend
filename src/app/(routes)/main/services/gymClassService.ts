import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  instructor?: string;
  instructorName?: string;
}

export interface GymClass {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  thumbnail?: string;
  gallery?: string[];
  schedule?: Schedule[];
  duration?: number;
  difficulty?: string;
  capacity?: number;
  features?: string[];
  requirements?: string[];
  category?: string;
  tags?: string[];
  isActive: boolean;
  isFeatured?: boolean;
  price?: number;
  rating?: number;
  reviewsCount?: number;
  enrolledCount?: number;
  videoUrl?: string;
  videoPoster?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GymClassesResponse {
  success: boolean;
  message: string;
  data: GymClass[];
}

export const gymClassService = {
  /**
   * Get active gym classes
   * @param limit - Number of classes to fetch
   */
  async getActiveClasses(limit?: number): Promise<GymClass[]> {
    try {
      const url = limit
        ? `${API_BASE_URL}/api/gymfolio/gym-classes/active?limit=${limit}`
        : `${API_BASE_URL}/api/gymfolio/gym-classes/active`;

      const response = await axios.get<GymClassesResponse>(url);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch gym classes');
      }

      // Transform the data to ensure consistent format
      return response.data.data.map(gymClass => ({
        ...gymClass,
        // Ensure thumbnail URL is absolute
        thumbnail: this.getAbsoluteImageUrl(gymClass.thumbnail),
        // Ensure gallery images are absolute
        gallery: gymClass.gallery?.map(img => this.getAbsoluteImageUrl(img))
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching gym classes:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch gym classes');
      }
      throw error;
    }
  },

  /**
   * Get featured gym classes for the homepage
   */
  async getFeaturedClasses(): Promise<GymClass[]> {
    try {
      const response = await axios.get<GymClassesResponse>(
        `${API_BASE_URL}/api/gymfolio/gym-classes/featured`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch featured classes');
      }

      return response.data.data.map(gymClass => ({
        ...gymClass,
        thumbnail: this.getAbsoluteImageUrl(gymClass.thumbnail),
        gallery: gymClass.gallery?.map(img => this.getAbsoluteImageUrl(img))
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching featured classes:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch featured classes');
      }
      throw error;
    }
  },

  /**
   * Get gym classes by category
   * @param category - Category name
   */
  async getClassesByCategory(category: string): Promise<GymClass[]> {
    try {
      const response = await axios.get<GymClassesResponse>(
        `${API_BASE_URL}/api/gymfolio/gym-classes/category/${encodeURIComponent(category)}`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch classes by category');
      }

      return response.data.data.map(gymClass => ({
        ...gymClass,
        thumbnail: this.getAbsoluteImageUrl(gymClass.thumbnail),
        gallery: gymClass.gallery?.map(img => this.getAbsoluteImageUrl(img))
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching classes by category:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch classes by category');
      }
      throw error;
    }
  },

  /**
   * Get a single gym class by ID
   * @param id - Class ID
   */
  async getClassById(id: string): Promise<GymClass> {
    try {
      const response = await axios.get<{ success: boolean; message: string; data: GymClass }>(
        `${API_BASE_URL}/api/gymfolio/gym-classes/${id}`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch class');
      }

      return {
        ...response.data.data,
        thumbnail: this.getAbsoluteImageUrl(response.data.data.thumbnail),
        gallery: response.data.data.gallery?.map(img => this.getAbsoluteImageUrl(img))
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching class:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch class');
      }
      throw error;
    }
  },

  /**
   * Get a single gym class by slug
   * @param slug - Class slug
   */
  async getClassBySlug(slug: string): Promise<GymClass> {
    try {
      const response = await axios.get<{ success: boolean; message: string; data: GymClass }>(
        `${API_BASE_URL}/api/gymfolio/gym-classes/slug/${slug}`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch class');
      }

      return {
        ...response.data.data,
        thumbnail: this.getAbsoluteImageUrl(response.data.data.thumbnail),
        gallery: response.data.data.gallery?.map(img => this.getAbsoluteImageUrl(img))
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error fetching class:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to fetch class');
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
   * Format difficulty level for display
   */
  getDifficultyLabel(difficulty?: string): string {
    const difficultyMap: { [key: string]: string } = {
      'Beginner': 'Beginner Friendly',
      'Intermediate': 'Intermediate',
      'Advanced': 'Advanced',
      'All Levels': 'All Levels'
    };

    return difficultyMap[difficulty || ''] || difficulty || 'All Levels';
  },

  /**
   * Format price for display
   */
  formatPrice(price?: number): string {
    if (!price) return 'Free';
    return `PKR ${price.toLocaleString()}`;
  }
};
