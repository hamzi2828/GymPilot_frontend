import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface RegistrationInput {
  username: string;
  phone: string;
  email: string;
  platform: 'gymwear' | 'gymfolio';
}

export interface Registration extends RegistrationInput {
  _id: string;
  status: 'pending' | 'contacted' | 'registered' | 'rejected';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const registrationService = {
  /**
   * Submit a new package registration
   */
  async submitRegistration(registrationData: RegistrationInput): Promise<Registration> {
    try {
      const response = await axios.post<ApiResponse<Registration>>(
        `${API_BASE_URL}/api/gymfolio/package-registrations`,
        registrationData
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to submit registration');
      }

      return response.data.data;
    } catch (error) {
      console.error('Error submitting registration:', error);
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },
};

export default registrationService;
