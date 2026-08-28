import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface ProductVariant {
  color: string;
  size: string;
  price: number;
  stock: number;
  sku?: string;
  discountedPrice?: number;
}

export interface ColorMediaData {
  thumbnailUrl?: string;
  bannerUrls: string[];
  thumbName?: string;
}

export interface Product {
  _id: string;
  name: string;
  slug?: string;
  category: string;
  price: number;
  discountedPrice?: number;
  stock: number;
  status: 'published' | 'draft' | 'out_of_stock';
  thumbnailUrl?: string;
  bannerUrls?: string[];
  productType?: 'single' | 'variant';
  variants?: ProductVariant[];
  colorMedia?: Record<string, ColorMediaData>;
}

export interface CollectionProduct {
  id: string;
  name: string;
  price: string;
  discountedPrice?: string;
  image: string;
  slug?: string;
}

interface ApiResponse<T> {
  message: string;
  data: T;
}

export const collectionService = {
  /**
   * Get random 10 products for the collection section
   * Uses the dedicated /products/random API endpoint
   */
  async getRandomProducts(): Promise<CollectionProduct[]> {
    try {
      const response = await axios.get<ApiResponse<Product[]>>(`${API_BASE_URL}/products/random?limit=10`);
      
      // Handle different response formats
      const products = response.data?.data || response.data || [];
      
      if (!Array.isArray(products)) {
        throw new Error('Invalid response format');
      }
      
      // Transform to CollectionProduct format
      return products.map(product => ({
        id: product._id,
        name: product.name,
        price: `$${product.discountedPrice || product.price}`,
        discountedPrice: product.discountedPrice ? `$${product.price}` : undefined,
        image: this.getProductImage(product),
        slug: product.slug
      }));
    } catch (error) {
      console.error('Error fetching random products:', error);
      return [];
    }
  },

  /**
   * Helper function to get product image with fallback
   */
  getProductImage(product: Product): string {
    // Priority: thumbnailUrl -> first banner -> fallback
    let imageUrl = product.thumbnailUrl;
    
    if (!imageUrl && product.bannerUrls && product.bannerUrls.length > 0) {
      imageUrl = product.bannerUrls[0];
    }
    
    if (!imageUrl) {
      // Use a variety of fallback images
      const fallbackImages = [
        '/images/gym-2.svg',
        '/images/gym-3.svg', 
        '/images/gym-4.svg',
        '/images/gym-5.svg',
        '/images/gym-6.svg',
        '/images/gym-7.svg'
      ];
      const randomIndex = Math.floor(Math.random() * fallbackImages.length);
      return fallbackImages[randomIndex];
    }
    
    // If it's already a full URL, return as is
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    // Otherwise, prepend the backend URL
    return `${API_BASE_URL}${imageUrl}`;
  },

};

export default collectionService;