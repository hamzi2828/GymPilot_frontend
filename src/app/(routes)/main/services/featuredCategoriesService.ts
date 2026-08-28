import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface FeaturedCategoryProduct {
  _id: string;
  name: string;
  slug?: string;
  price: number;
  discountedPrice?: number;
  stock: number;
  status: 'published' | 'draft' | 'out_of_stock';
  thumbnailUrl?: string;
  bannerUrls?: string[];
}

export interface FeaturedCategoryWithProducts {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  active: boolean;
  featured: boolean;
  products: FeaturedCategoryProduct[];
  createdAt?: string;
  updatedAt?: string;
}

// Map backend URLs to absolute URLs
function absolutizeUrl(url?: string): string | undefined {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = (API_BASE_URL || '').replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

// Map backend response to frontend shape
function mapFeaturedCategory(dto: unknown): FeaturedCategoryWithProducts {
  const data = dto as Record<string, unknown>;
  return {
    _id: data._id as string,
    name: data.name as string,
    slug: data.slug as string,
    description: (data.description as string) ?? '',
    thumbnailUrl: absolutizeUrl(data.thumbnailUrl as string),
    bannerUrl: absolutizeUrl(data.bannerUrl as string),
    active: data.active as boolean,
    featured: (data.featured as boolean) ?? false,
    products: ((data.products as unknown[]) || []).map((product: unknown) => {
      const prod = product as Record<string, unknown>;
      return {
        _id: prod._id as string,
        name: prod.name as string,
        slug: prod.slug as string,
        price: prod.price as number,
        discountedPrice: prod.discountedPrice as number,
        stock: prod.stock as number,
        status: prod.status as 'published' | 'draft' | 'out_of_stock',
        thumbnailUrl: absolutizeUrl(prod.thumbnailUrl as string),
        bannerUrls: ((prod.bannerUrls as string[]) || []).map((url: string) => absolutizeUrl(url)).filter(Boolean) as string[],
      };
    }),
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  };
}

export const featuredCategoriesService = {
  // Fetch featured categories with their products (max 6 per category)
  async getFeaturedCategoriesWithProducts(): Promise<FeaturedCategoryWithProducts[]> {
    try {
      const res = await axios.get(`${API_BASE_URL}/categories/featured-with-products?limit=6`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = res.data?.data ?? res.data ?? [];
      
      if (Array.isArray(data)) {
        return data.map(mapFeaturedCategory);
      }
      
      return [];
    } catch (err) {
      console.error('Error fetching featured categories with products:', err);
      throw err;
    }
  },

  // Fallback method if the new API endpoint doesn't exist yet
  // This will fetch categories and products separately (current implementation)
  async getFeaturedCategoriesWithProductsFallback(): Promise<FeaturedCategoryWithProducts[]> {
    // Fallback method is not available - admin services are not implemented
    throw new Error('Fallback method not available. Please ensure the main API endpoint is working.');

    /* Original implementation - disabled due to missing dependencies
    try {
      // Import services dynamically to avoid circular dependencies
      const { categoryService } = await import('../../admin/products/services/categoryService');
      const { productService } = await import('../../admin/products/services/productService');

      const [categoriesData, productsData] = await Promise.all([
        categoryService.listCategories(),
        productService.listProducts()
      ]);

      const featuredCategories = categoriesData.filter(cat => cat.active && cat.featured);
      const publishedProducts = productsData.filter(prod => prod.status === 'published');

      return featuredCategories.map(category => ({
        _id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        thumbnailUrl: category.thumbnailUrl,
        bannerUrl: category.bannerUrl,
        active: category.active,
        featured: category.featured,
        products: publishedProducts
          .filter(product => product.category === category.name)
          .slice(0, 6)
          .map(product => ({
            _id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            discountedPrice: product.discountedPrice,
            stock: product.stock,
            status: product.status,
            thumbnailUrl: product.thumbnailUrl,
            bannerUrls: product.bannerUrls,
          })),
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }));
    } catch (err) {
      console.error('Error in fallback method:', err);
      throw err;
    }
    */
  },

  // Smart method that tries the new API first, falls back to old method
  async getFeaturedCategoriesWithProductsSmart(): Promise<FeaturedCategoryWithProducts[]> {
    try {
      // Try the new API endpoint first
      return await this.getFeaturedCategoriesWithProducts();
    } catch (error) {
      console.log('New API endpoint not available, using fallback method', error);
      // Fall back to the old method
      return await this.getFeaturedCategoriesWithProductsFallback();
    }
  },
};