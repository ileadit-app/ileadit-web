import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthCard } from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Sign in — ileadit",
  description: "Sign in to your ileadit account.",
};

/**
 * Sign-in design spec §2: `/login` and `/signup` are ~5-line wrappers
 * rendering the same `AuthCard`/`AuthLayout` pair with a different `mode` —
 * all provider wiring, error handling and the collision flow live in
 * AuthCard itself so the two screens can never visually drift apart.
 *
 * `AuthCard` reads `useSearchParams()` (for `?redirect=`/`?email=`), which
 * Next's App Router requires to be wrapped in a `<Suspense>` boundary on a
 * statically-rendered route.
 */
export default function LoginPage() {
  return (
    <AuthLayout mode="signin">
      <Suspense fallback={null}>
        <AuthCard mode="signin" />
      </Suspense>
    </AuthLayout>
  );
}
