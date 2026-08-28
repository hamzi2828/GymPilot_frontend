export interface PublicProduct {
  _id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  discountedPrice?: number;
  discountPercent?: number;
  stock: number;
  status: 'draft' | 'published';
  featured?: boolean;
  thumbnailUrl?: string;
  bannerUrls?: string[];
  productType?: 'single' | 'variant';
  variants?: Array<{
    color?: string;
    size?: string;
    price: number;
    stock: number;
  }>;
  colorMedia?: {
    [color: string]: {
      thumbnailUrl: string;
      bannerUrls: string[];
    }
  };
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  createdAt?: string;
  updatedAt?: string;
  slug?: string;
}

export interface ProductsResponse {
  success: boolean;
  data: PublicProduct[];
  count: number;
  total?: number;
  page?: number;
  totalPages?: number;
}

export interface ProductResponse {
  success: boolean;
  data: PublicProduct;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export const publicProductService = {
  async getAllProducts(
    limit: number = 50,
    page: number = 1,
    sortBy: string = 'createdAt',
    sortOrder: string = 'desc'
  ): Promise<ProductsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/public/products?limit=${limit}&page=${page}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status}`);
    }

    return response.json();
  },

  async getLatestProducts(limit: number = 10): Promise<ProductsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/public/products/latest?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch latest products: ${response.status}`);
    }

    return response.json();
  },

  async getRandomProducts(limit: number = 10): Promise<ProductsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/public/products/random?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch random products: ${response.status}`);
    }

    return response.json();
  },

  async getFeaturedProducts(limit: number = 10): Promise<ProductsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/public/products/featured?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch featured products: ${response.status}`);
    }

    return response.json();
  },

  async getProductById(id: string): Promise<ProductResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/public/products/${id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.status}`);
    }

    return response.json();
  },

  async getProductsByCategory(
    category: string,
    limit: number = 20,
    page: number = 1
  ): Promise<ProductsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/public/products/category/${encodeURIComponent(category)}?limit=${limit}&page=${page}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch products by category: ${response.status}`);
    }

    return response.json();
  },

  async searchProducts(
    query: string,
    limit: number = 20,
    page: number = 1
  ): Promise<ProductsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/public/products/search?q=${encodeURIComponent(query)}&limit=${limit}&page=${page}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search products: ${response.status}`);
    }

    return response.json();
  },
};