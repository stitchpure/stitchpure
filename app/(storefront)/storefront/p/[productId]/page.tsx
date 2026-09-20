import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import InquiryForm from "@/components/storefront/InquiryForm";
import ProductDetailClient from "@/components/storefront/ProductDetailClient";
import JsonLd from "@/components/seo/JsonLd";
import {
  getStorefrontProductById,
  getStorefrontProductOptions,
} from "@/services/storefront.service";
import { ServiceError } from "@/lib/service-error";
import { SITE_URL, SITE_NAME } from "@/lib/site";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Params = Promise<{ productId: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { productId } = await params;
  if (!UUID_RE.test(productId)) {
    return { title: `Product | ${SITE_NAME}` };
  }

  try {
    const product = await getStorefrontProductById(productId);
    const title = `${product.name} | ${SITE_NAME}`.slice(0, 60);
    const description = (
      product.description?.trim() ||
      `${product.name} — available from ${SITE_NAME}.`
    ).slice(0, 160);

    return {
      title,
      description,
      alternates: {
        canonical: `/storefront/p/${productId}`,
      },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/storefront/p/${productId}`,
        images: product.images?.[0]
          ? [{ url: product.images[0] }]
          : [{ url: "/placeholder-product.svg" }],
      },
    };
  } catch {
    return { title: `Product | ${SITE_NAME}` };
  }
}

export default async function StorefrontProductPage({
  params,
}: {
  params: Params;
}) {
  const { productId } = await params;

  if (!UUID_RE.test(productId)) {
    notFound();
  }

  let product;
  try {
    product = await getStorefrontProductById(productId);
  } catch (error) {
    if (error instanceof ServiceError && error.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  const options = await getStorefrontProductOptions(product.productId);

  const price = Number(product.wholesalePrice);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description?.trim()
      ? { description: product.description.trim() }
      : {}),
    ...(product.images?.length ? { image: product.images } : {}),
    ...(product.categoryName ? { category: product.categoryName } : {}),
    url: `${SITE_URL}/storefront/p/${product.productId}`,
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: Number.isFinite(price) ? price.toFixed(2) : "0.00",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/storefront/p/${product.productId}`,
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
      },
    },
  };

  return (
    <div className="sf-animate-in space-y-10 sm:space-y-12">
      <JsonLd data={productJsonLd} />

      <nav className="text-sm text-[var(--sf-muted)]">
        <Link href="/" className="hover:text-[var(--sf-accent)]">
          Products
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--sp-ink)]">{product.name}</span>
      </nav>

      <ProductDetailClient
        productName={product.name}
        categoryName={product.categoryName}
        description={product.description}
        price={Number.isFinite(price) ? price : 0}
        images={product.images}
        companyName={product.companyName}
        companyPhone={product.companyPhone}
        options={options}
      />

      <div id="inquiry" className="scroll-mt-24">
        <InquiryForm
          companyId={product.companyId}
          productId={product.productId}
          productName={product.name}
          companyName={product.companyName}
        />
      </div>
    </div>
  );
}
