import { Suspense } from "react";
import ClientDashboardLoader from "../components/ClientDashboardLoader";
import LoadingDashboardSkeleton from "../components/LoadingDashboardSkeleton";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function Page({ searchParams }: PageProps) {
  const selectedWeek = typeof searchParams.week === 'string' ? searchParams.week : 'latest';
  const weeksWindow = typeof searchParams.weeks === 'string' ? parseInt(searchParams.weeks, 10) : 12;

  return (
    <Suspense fallback={<LoadingDashboardSkeleton />}>
      <ClientDashboardLoader 
        selectedWeek={selectedWeek}
        weeksWindow={weeksWindow}
      />
    </Suspense>
  );
}
