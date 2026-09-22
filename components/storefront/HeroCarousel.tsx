"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export interface HeroSlide {
  /** Background image URL. Falls back to the gradient hero if omitted. */
  image?: string;
  chip?: string;
  /** Title lines. The last line is rendered as an outlined accent. */
  titleTop: string;
  titleAccent: string;
  subtitle?: string;
  ctaLabel: string;
  ctaHref: string;
}

interface HeroCarouselProps {
  slides: HeroSlide[];
  /** Auto-advance interval in ms. Set to 0 to disable. */
  intervalMs?: number;
}

export default function HeroCarousel({
  slides,
  intervalMs = 6000,
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = slides.length;
  const hasMultiple = count > 1;

  const goTo = useCallback(
    (next: number) => {
      setIndex((next + count) % count);
    },
    [count]
  );

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  // Auto-advance (paused on hover / focus).
  useEffect(() => {
    if (!hasMultiple || intervalMs <= 0 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [hasMultiple, intervalMs, paused, count]);

  if (count === 0) return null;

  return (
    <section
      className="sp-hero sf-animate-in relative h-[420px] sm:h-[480px] lg:h-[560px]"
      aria-roledescription="carousel"
      aria-label="Featured banners"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Slides — all absolutely positioned so the carousel height stays
          constant regardless of which slide's content is showing. */}
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={!active}
            className={`absolute inset-0 flex items-center transition-opacity duration-700 ease-out ${
              active
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
            {/* Background: image + dark overlay, or the default gradient */}
            {slide.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
              </>
            ) : (
              <>
                <div className="sp-hero__bg" />
                <div className="sp-hero__noise" />
              </>
            )}

            {/* Content */}
            <div className="relative max-w-2xl px-5 py-10 sm:px-12 lg:px-16">
              {slide.chip ? <span className="sp-chip">{slide.chip}</span> : null}
              <h1 className="sp-hero__title mt-5 text-4xl sm:mt-6 sm:text-7xl lg:text-[5.5rem]">
                {slide.titleTop}
                <br />
                <span className="sp-outline-text">{slide.titleAccent}</span>
              </h1>
              {slide.subtitle ? (
                <p className="mt-5 max-w-md text-sm leading-6 text-[color:rgba(244,241,234,0.82)] sm:mt-6 sm:text-base sm:leading-7">
                  {slide.subtitle}
                </p>
              ) : null}
              <div className="mt-7 sm:mt-8">
                <Link href={slide.ctaHref} className="sp-btn sp-btn--lime">
                  {slide.ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        );
      })}

      {/* Arrow CTAs */}
      {hasMultiple ? (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous banner"
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/70 sm:left-5"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next banner"
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/70 sm:right-5"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 sm:bottom-6">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to banner ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index
                    ? "w-6 bg-white"
                    : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
