import { Skeleton } from "@/components/atoms/Card";

export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
