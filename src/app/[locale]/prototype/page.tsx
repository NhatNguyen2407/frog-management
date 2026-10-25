import type { Metadata } from "next";

export const metadata: Metadata = { title: "Frog Management - UI Prototype", robots: { index: false, follow: false } };

export default function PrototypePage() {
  return <iframe title="Frog Management UI prototype" src="/prototype/index.html" className="fixed inset-0 h-dvh w-full border-0" />;
}