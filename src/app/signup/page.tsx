import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthCard } from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "Create your account — ileadit",
  description: "Create your ileadit account — the same account you'd get in the app.",
};

/** See src/app/login/page.tsx's comment — same shell, `mode="signup"`. */
export default function SignupPage() {
  return (
    <AuthLayout mode="signup">
      <Suspense fallback={null}>
        <AuthCard mode="signup" />
      </Suspense>
    </AuthLayout>
  );
}
