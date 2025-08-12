"use client";

import dynamic from "next/dynamic";
import React from "react";
import LoadingDashboardSkeleton from "./LoadingDashboardSkeleton";
import type ClientDashboardComp from "./ClientDashboard";

// Dynamically load the client dashboard in a client boundary, with a loading skeleton.
const ClientDashboard = dynamic(
  () => import("./ClientDashboard"),
  { ssr: false, loading: () => <LoadingDashboardSkeleton /> }
);

// Reuse the prop types from the real component without importing it at runtime
export type ClientDashboardProps = React.ComponentProps<typeof ClientDashboardComp>;

export default function ClientDashboardLoader(props: ClientDashboardProps) {
  return <ClientDashboard {...props} />;
}
