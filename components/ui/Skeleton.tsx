interface SkeletonProps {
  className?: string;
}

/**
 * Animated gray pulse skeleton block.
 * Pass a `className` to control width, height, and border-radius for shape composability.
 *
 * Examples:
 *   <Skeleton className="h-4 w-32 rounded" />        // short text line
 *   <Skeleton className="h-10 w-full rounded-md" />   // input-height bar
 *   <Skeleton className="h-24 w-24 rounded-full" />   // avatar circle
 */
export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 ${className}`}
      aria-hidden="true"
    />
  );
}
