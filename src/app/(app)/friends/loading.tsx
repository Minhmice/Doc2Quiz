import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function FriendsLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 px-4 py-6 sm:px-6" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <div className="mt-4 flex gap-2 overflow-hidden pb-1">
        <Skeleton className="h-10 w-20 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
      </div>
      <div className="mt-4 flex gap-2 overflow-hidden pb-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <section className="mt-6 space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
              <Skeleton className="h-9 w-20" />
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
