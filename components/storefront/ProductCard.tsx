"use client";

import Link from "next/link";
import type { StorefrontProduct } from "@/types/storefront";

const PLACEHOLDER = "/placeholder-product.svg";

function formatPrice(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

interface ProductCardProps {
  product: StorefrontProduct;
  priority?: boolean;
}

function productDetailHref(product: StorefrontProduct): string {
  if (product.productId) {
    return `/storefront/p/${product.productId}`;
  }
  return "/";
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const images = product.images ?? [];
  const imageSrc = images[0] || PLACEHOLDER;
  const price = Number(product.wholesalePrice);
  const detailHref = productDetailHref(product);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--sf-line)] bg-white transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(16,16,15,0.12)]">
      <Link href={detailHref} className="relative aspect-square w-full overflow-hidden bg-[#ece9e2]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          loading={priority ? "eager" : "lazy"}
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith(PLACEHOLDER)) {
              img.src = PLACEHOLDER;
            }
          }}
        />
        {product.categoryName ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-[var(--sp-ink)]/90 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[var(--sp-paper)] backdrop-blur">
            {product.categoryName}
          </span>
        ) : null}
      </Link>

      <div className="flex items-center justify-between gap-2 p-3">
        <h2 className="sf-display truncate text-sm font-bold uppercase tracking-[-0.01em] text-[var(--sp-ink)]">
          <Link href={detailHref} className="hover:text-[var(--sf-accent)]">
            {product.name}
          </Link>
        </h2>
        <p className="sf-display shrink-0 text-sm font-extrabold tracking-tight text-[var(--sp-ink)]">
          {formatPrice(Number.isFinite(price) ? price : 0)}
        </p>
      </div>
    </article>
  );
}
