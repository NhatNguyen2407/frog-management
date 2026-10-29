"use client";
import dynamic from "next/dynamic";

const Chart = dynamic(() => import("./chart"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" />,
});
export function LazyRevenueChart({
  rows,
}: {
  rows: { local_hour: string; revenue_vnd: number }[];
}) {
  return <Chart rows={rows} />;
}
