import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPage } from "@/components/owner/Page";

/** Shown while any dashboard page loads its data. */
export default function OwnerLoading() {
  return (
    <DashboardPage>
      <div aria-busy="true" aria-label="Loading">
        <Skeleton className="h-9 w-56 max-w-full" />
        <div className="mt-6 divide-y rounded-2xl border bg-card">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </DashboardPage>
  );
}
