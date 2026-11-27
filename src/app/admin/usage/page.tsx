import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { UsageGate } from "@/components/admin/usage/UsageGate";

// Admin-only operational page: kept out of search results. It is deliberately
// not in the public nav or the sitemap, and not in robots.txt either (a
// disallow line would advertise the path).
export const metadata: Metadata = {
  title: "Usage",
  robots: { index: false, follow: false },
};

export default function AdminUsagePage() {
  return (
    <ProtectedRoute>
      <UsageGate />
    </ProtectedRoute>
  );
}
