export interface StorefrontProduct {
  id: string;
  productId: string;
  name: string;
  slug: string;
  description: string | null;
  images: string[] | null;
  categoryName: string | null;
  wholesalePrice: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  companyPhone: string | null;
  companyEmail: string;
}

export interface StorefrontProductDetail extends StorefrontProduct {
  companyLogo: string | null;
  companyAddress: string | null;
}

export interface StorefrontCategory {
  id: string;
  name: string;
  bannerImage: string | null;
}

export interface StorefrontPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductWithListing {
  productId: string;
  productName: string;
  productImages: string[];
  listing: {
    id: string;
    wholesalePrice: string;
    isVisible: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface StorefrontInquiry {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  createdAt: string;
  productId: string | null;
  productName: string | null;
}
