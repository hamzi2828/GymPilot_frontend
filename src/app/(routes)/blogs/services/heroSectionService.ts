const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Backend response interfaces
interface BackendBlogData {
  _id: string;
  title: string;
  content: string;
  image: string;
  thumbnail: string;
  slug: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  excerpt?: string;
  readingTime?: number;
  author?: {
    name: string;
    email: string;
    avatar?: string;
  };
}

interface BackendCategoryWithBlog {
  id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  blog: BackendBlogData | null;
}

interface BackendCategoryWithBlogs {
  id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  blogs: BackendBlogData[];
}

export interface HeroSectionData {
  id?: string;
  title: string;
  subtitle: string;
  backgroundImage: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogData {
  _id: string;
  title: string;
  content: string;
  image: string;
  thumbnail: string;
  slug: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  excerpt?: string;
  readingTime?: number;
  author?: {
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface FeaturedCategoryWithBlog {
  id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  blog: BlogData | null;
}

export interface FeaturedCategoryWithBlogs {
  id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  blogs: BlogData[];
}

class HeroSectionService {
  async getActiveHeroSection(): Promise<HeroSectionData | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/blog-hero/active`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // No active hero section found
        }
        throw new Error(`Failed to fetch hero section: ${response.statusText}`);
      }

      const data = await response.json();
      const heroData = data.data || data;

      // Ensure background image has full URL if it's a relative path
      if (heroData && heroData.backgroundImage && heroData.backgroundImage.startsWith('/uploads/')) {
        heroData.backgroundImage = `${API_BASE_URL}${heroData.backgroundImage}`;
      }

      return heroData;
    } catch (error) {
      console.error('Error fetching hero section:', error);
      throw error;
    }
  }

  async getFeaturedCategoriesWithBlog(): Promise<FeaturedCategoryWithBlog[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/featured-categories-withblog`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch featured categories: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch featured categories');
      }

      const categories = data.data || [];

      // Process each category's blog data
      return categories.map((category: BackendCategoryWithBlog) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        blog: category.blog ? {
          ...category.blog,
          // Ensure image URLs have full path if relative
          image: category.blog.image?.startsWith('/uploads/')
            ? `${API_BASE_URL}${category.blog.image}`
            : category.blog.image,
          thumbnail: category.blog.thumbnail?.startsWith('/uploads/')
            ? `${API_BASE_URL}${category.blog.thumbnail}`
            : category.blog.thumbnail,
        } : null
      }));
    } catch (error) {
      console.error('Error fetching featured categories with blog:', error);
      throw error;
    }
  }

  // New method to get featured categories with 6 blogs each
  async getFeaturedCategoriesWithSixBlogs(): Promise<FeaturedCategoryWithBlogs[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/featured-categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch featured categories: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch featured categories');
      }

      const categories = data.data || [];

      // Process each category's blogs data
      return categories.map((category: BackendCategoryWithBlogs) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        thumbnailUrl: category.thumbnailUrl?.startsWith('/uploads/')
          ? `${API_BASE_URL}${category.thumbnailUrl}`
          : category.thumbnailUrl,
        bannerUrl: category.bannerUrl?.startsWith('/uploads/')
          ? `${API_BASE_URL}${category.bannerUrl}`
          : category.bannerUrl,
        blogs: (category.blogs || []).map((blog: BackendBlogData) => ({
          ...blog,
          // Ensure image URLs have full path if relative
          image: blog.image?.startsWith('/uploads/')
            ? `${API_BASE_URL}${blog.image}`
            : blog.image,
          thumbnail: blog.thumbnail?.startsWith('/uploads/')
            ? `${API_BASE_URL}${blog.thumbnail}`
            : blog.thumbnail,
        }))
      }));
    } catch (error) {
      console.error('Error fetching featured categories with blogs:', error);
      throw error;
    }
  }

  async getFeaturedCategoriesWithBlogs(): Promise<FeaturedCategoryWithBlogs[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/featured-categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch featured categories: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch featured categories');
      }

      const categories = data.data || [];

      // Process each category's blogs data
      return categories.map((category: BackendCategoryWithBlogs) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        thumbnailUrl: category.thumbnailUrl?.startsWith('/uploads/')
          ? `${API_BASE_URL}${category.thumbnailUrl}`
          : category.thumbnailUrl,
        bannerUrl: category.bannerUrl?.startsWith('/uploads/')
          ? `${API_BASE_URL}${category.bannerUrl}`
          : category.bannerUrl,
        blogs: (category.blogs || []).map((blog: BackendBlogData) => ({
          ...blog,
          // Ensure image URLs have full path if relative
          image: blog.image?.startsWith('/uploads/')
            ? `${API_BASE_URL}${blog.image}`
            : blog.image,
          thumbnail: blog.thumbnail?.startsWith('/uploads/')
            ? `${API_BASE_URL}${blog.thumbnail}`
            : blog.thumbnail,
        }))
      }));
    } catch (error) {
      console.error('Error fetching featured categories with blogs:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const heroSectionService = new HeroSectionService();