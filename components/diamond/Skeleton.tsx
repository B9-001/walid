// Shimmer placeholders shown while content loads.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-brand-blush/60 rounded ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="card-soft h-full flex flex-col overflow-hidden">
      <div className="aspect-square animate-pulse bg-brand-blush/60" />
      <div className="p-5 flex flex-col gap-3">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-5 w-3/4" />
        <div className="mt-3 pt-3 border-t border-brand-line/60 flex justify-between items-center">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
      {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-12 md:py-16">
      <Skeleton className="h-3 w-24 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">
        <Skeleton className="aspect-square rounded-[2rem]" />
        <div className="flex flex-col gap-4 pt-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-20 w-full mt-2" />
          <Skeleton className="h-14 w-full rounded-full mt-4" />
        </div>
      </div>
    </div>
  );
}
