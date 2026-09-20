import ProductCard from "./ProductCard";
import type { StorefrontProduct } from "@/types/storefront";

interface ProductGridProps {
  products: StorefrontProduct[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className="sf-grid-animate grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={index < 4}
        />
      ))}
    </div>
  );
}
