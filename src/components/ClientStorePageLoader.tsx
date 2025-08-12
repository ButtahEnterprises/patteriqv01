"use client";

import dynamic from "next/dynamic";
import React from "react";
import LoadingStoreSkeleton from "./LoadingStoreSkeleton";
import type ClientStorePageComp from "./ClientStorePage";

const ClientStorePage = dynamic(
  () => import("./ClientStorePage"),
  { ssr: false, loading: () => <LoadingStoreSkeleton /> }
);

export type ClientStorePageProps = React.ComponentProps<typeof ClientStorePageComp>;

export default function ClientStorePageLoader(props: ClientStorePageProps) {
  return <ClientStorePage {...props} />;
}
