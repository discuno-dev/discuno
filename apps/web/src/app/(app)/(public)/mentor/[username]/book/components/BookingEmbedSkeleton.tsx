import { Skeleton } from '~/components/ui/skeleton'

export const BookingEmbedSkeleton = () => {
  return (
    <div className="animate-in fade-in min-h-[600px] w-full p-6 duration-200">
      {/* Header skeleton */}
      <div className="mb-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Calendar view skeleton */}
      <div className="animate-in fade-in space-y-4 duration-200">
        {/* Calendar header with month/year */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>

        {/* Calendar grid */}
        <div className="space-y-2">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>

          {/* Calendar dates */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>

        {/* Time slots section */}
        <div className="mt-8 space-y-3">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>

        {/* Form section placeholder */}
        <div className="mt-8 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  )
}
