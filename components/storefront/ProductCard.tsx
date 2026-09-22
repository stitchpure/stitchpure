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
  const hoverSrc = images[1];
  const hasHoverImage = Boolean(hoverSrc);
  const price = Number(product.wholesalePrice);
  const detailHref = productDetailHref(product);

  return (
    <article className="group flex h-full flex-col">
      <Link
        href={detailHref}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#eceae6]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={product.name}
          className={`h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-[1.03] ${
            hasHoverImage ? "group-hover:opacity-0" : ""
          }`}
          loading={priority ? "eager" : "lazy"}
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith(PLACEHOLDER)) {
              img.src = PLACEHOLDER;
            }
          }}
        />
        {hasHoverImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={hoverSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 ease-out group-hover:scale-[1.03] group-hover:opacity-100"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.src.endsWith(PLACEHOLDER)) {
                img.src = PLACEHOLDER;
              }
            }}
          />
        ) : null}
      </Link>

      <div className="flex items-start justify-between gap-3 pt-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-[0.8rem] font-semibold text-[var(--sp-ink)]">
            <Link href={detailHref} className="hover:text-[var(--sf-accent)]">
              {product.name}
            </Link>
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-[var(--sf-soft)]">
            {formatPrice(Number.isFinite(price) ? price : 0)}
          </p>
        </div>

        <Link
          href={detailHref}
          aria-label={`View ${product.name}`}
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--sp-ink)] text-[var(--sp-ink)] transition-colors hover:bg-[var(--sp-ink)] hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
