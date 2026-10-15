import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPage } from "@/components/owner/Page";

/** Shown while any dashboard page loads its data. */
export default function OwnerLoading() {
  return (
    <DashboardPage>
      <div aria-busy="true" aria-label="Loading">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-11 w-72 max-w-full" />
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border bg-card p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-5 h-9 w-20" />
              <Skeleton className="mt-3 h-3 w-28" />
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <div className="mt-6 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-10 shrink-0" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
