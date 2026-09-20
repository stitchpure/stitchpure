export default function LoadingGrid() {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading products"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--sf-radius)] border border-[var(--sf-line)] bg-white/60"
        >
          <div className="aspect-[4/3] animate-pulse bg-[#e4ebe9]" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-16 animate-pulse rounded bg-[#e4ebe9]" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-[#e4ebe9]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[#e4ebe9]" />
            <div className="h-5 w-2/5 animate-pulse rounded bg-[#e4ebe9]" />
            <div className="flex gap-2 pt-2">
              <div className="h-9 flex-1 animate-pulse rounded-md bg-[#e4ebe9]" />
              <div className="h-9 flex-1 animate-pulse rounded-md bg-[#e4ebe9]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
