"use client";

import { useState } from "react";

const PLACEHOLDER = "/placeholder-product.svg";

interface ProductGalleryProps {
  images: string[] | null;
  name: string;
}

export default function ProductGallery({ images, name }: ProductGalleryProps) {
  const list = (images ?? []).filter(Boolean);
  const sources = list.length > 0 ? list : [PLACEHOLDER];
  const [active, setActive] = useState(0);
  const src = sources[Math.min(active, sources.length - 1)];

  return (
    <div className="space-y-3">
      <div className="sf-card-shadow aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-[var(--sf-line)] bg-[#e8eeec]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.src.endsWith(PLACEHOLDER)) img.src = PLACEHOLDER;
          }}
        />
      </div>
      {sources.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sources.map((thumb, i) => (
            <button
              key={`${thumb}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-0.5 transition-colors ${
                i === active
                  ? "border-[var(--sf-accent)]"
                  : "border-[var(--sf-line)]"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
