import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface BlogCategory {
  _id: string;
  name: string;
}

export interface FeaturedBlog {
  _id: string;
  title: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  image?: string;
  thumbnail?: string;
  status: 'published' | 'draft';
  categoryId?: BlogCategory;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogsResponse {
  success: boolean;
  message: string;
  data: FeaturedBlog[];
}

export const blogsService = {
  /**
   * Get featured blogs (latest 3 published blogs) for BlogsSection
   */
  async getFeaturedBlogs(): Promise<FeaturedBlog[]> {
    try {
      const response = await axios.get<BlogsResponse>(`${API_BASE_URL}/blogs/featured?limit=3`);
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'Failed to fetch featured blogs');
      }
      
      // Transform the data to ensure consistent format
      return response.data.data.map(blog => ({
        ...blog,
        // Extract category name from populated categoryId or use existing category field
        category: blog.categoryId?.name || blog.category || '',
        // Ensure image URL is absolute
        image: this.getAbsoluteImageUrl(blog.image),
        thumbnail: this.getAbsoluteImageUrl(blog.thumbnail)
      }));
    } catch (error) {
      console.error('Error fetching featured blogs:', error);
      
      // Return fallback blogs if API fails
      return this.getFallbackBlogs();
    }
  },

  /**
   * Helper function to convert relative URLs to absolute URLs
   */
  getAbsoluteImageUrl(imagePath?: string): string | undefined {
    if (!imagePath) return undefined;
    
    // If already absolute URL, return as is
    if (imagePath.startsWith('http')) return imagePath;
    
    // Convert relative to absolute
    return `${API_BASE_URL}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
  },

  /**
   * Fallback blogs when API is not available
   */
  getFallbackBlogs(): FeaturedBlog[] {
    return [
      {
        _id: '1',
        title: 'Essential Gym Equipment for Home Workouts',
        slug: 'essential-gym-equipment-home-workouts',
        content: 'Discover the must-have gym equipment that will transform your home into a personal fitness studio. From resistance bands to adjustable dumbbells, we cover everything you need to get started.',
        excerpt: 'Transform your home into a personal fitness studio with these essential pieces of equipment.',
        image: '/images/gym-2.svg',
        status: 'published',
        category: 'Equipment Guide',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        _id: '2',
        title: 'Top 10 High-Protein Snacks for Athletes',
        slug: 'top-10-high-protein-snacks-athletes',
        content: 'Fuel your workouts and recovery with these delicious, protein-packed snacks. Perfect for pre and post-workout nutrition to maximize your fitness results.',
        excerpt: 'Discover protein-rich snacks that will fuel your workouts and aid recovery.',
        image: '/images/gym-4.svg',
        status: 'published',
        category: 'Nutrition',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        _id: '3',
        title: 'Beginner\'s Guide to Strength Training',
        slug: 'beginners-guide-strength-training',
        content: 'Start your strength training journey with confidence. Learn proper form, essential exercises, and progressive techniques to build muscle safely and effectively.',
        excerpt: 'Master the basics of strength training with our comprehensive beginner guide.',
        image: '/images/gym-6.svg',
        status: 'published',
        category: 'Training',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }
};

export default blogsService;