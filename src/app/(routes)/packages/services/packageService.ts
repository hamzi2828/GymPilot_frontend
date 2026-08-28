import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface Package {
  _id: string;
  name: string;
  price: string;
  currency: string;
  period: string;
  features: string[];
  theme?: 'light' | 'dark';
  badge?: string;
  supportingText?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const packageService = {
  /**
   * Get all active packages
   */
  async getActivePackages(): Promise<Package[]> {
    try {
      const response = await axios.get<ApiResponse<Package[]>>(`${API_BASE_URL}/api/gymfolio/packages/active`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to fetch packages');
      }

      return response.data.data;
    } catch (error) {
      console.error('Error fetching active packages:', error);
      throw error;
    }
  },
};

export default packageService;
