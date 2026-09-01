import { Skeleton } from "@/components/ui/skeleton";

/** Route-level skeleton matching /discover/[id] layout. */
export function VideoDetailsPageSkeleton() {
  return (
    <div className="container max-w-7xl mx-auto px-4" aria-busy="true" aria-label="Loading video">
      <div className="my-5">
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
      <div className="py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="w-full space-y-4">
            <Skeleton className="h-8 w-3/4 max-w-md" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="aspect-video w-full rounded-lg" />
            <div className="flex items-center justify-between mt-4 gap-4">
              <Skeleton className="h-4 w-20" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-full" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
