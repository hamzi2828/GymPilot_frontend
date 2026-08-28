const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface Author {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  avatarUrl?: string;
  id: string;
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
  author?: Author;
  categoryId?: {
    _id: string;
    name: string;
  };
}

export interface BlogResponse {
  success: boolean;
  message: string;
  data: BlogData[];
}

export interface SingleBlogResponse {
  success: boolean;
  message: string;
  data: BlogData;
}

class BlogService {
  async getLatestBlogs(limit: number = 4): Promise<BlogData[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/featured?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch latest blogs: ${response.statusText}`);
      }

      const data: BlogResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch latest blogs');
      }

      // Process blog data to ensure proper image URLs
      return data.data.map((blog) => ({
        ...blog,
        image: blog.image?.startsWith('/uploads/')
          ? `${API_BASE_URL}${blog.image}`
          : blog.image,
        thumbnail: blog.thumbnail?.startsWith('/uploads/')
          ? `${API_BASE_URL}${blog.thumbnail}`
          : blog.thumbnail,
      }));
    } catch (error) {
      console.error('Error fetching latest blogs:', error);
      throw error;
    }
  }

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} min ago`;
      }
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
    } else if (diffInDays === 1) {
      return '1 day ago';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else {
      const months = Math.floor(diffInDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
  }

  async getBlogBySlug(slug: string): Promise<BlogData> {
    try {
      const response = await fetch(`${API_BASE_URL}/blogs/${slug}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch blog: ${response.statusText}`);
      }

      const data: SingleBlogResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch blog');
      }

      // Process blog data to ensure proper image URLs
      const blog = {
        ...data.data,
        image: data.data.image?.startsWith('/uploads/')
          ? `${API_BASE_URL}${data.data.image}`
          : data.data.image,
        thumbnail: data.data.thumbnail?.startsWith('/uploads/')
          ? `${API_BASE_URL}${data.data.thumbnail}`
          : data.data.thumbnail,
      };

      return blog;
    } catch (error) {
      console.error('Error fetching blog by slug:', error);
      throw error;
    }
  }

  estimateReadingTime(content: string): string {
    const wordsPerMinute = 200;
    const textContent = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
    const wordCount = textContent.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} min read`;
  }
}

// Export a singleton instance
export const blogService = new BlogService();