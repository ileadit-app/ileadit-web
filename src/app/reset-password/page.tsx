import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordCard } from "@/components/auth/ResetPasswordCard";

export const metadata: Metadata = {
  title: "Reset password — ileadit",
  description: "Get a link to choose a new password for your ileadit account.",
};

/** Target of the sign-in form's "Forgot password?" link (WEB-AUTH-1 / WEB-B2). */
export default function ResetPasswordPage() {
  return (
    <AuthLayout mode="reset">
      <ResetPasswordCard />
    </AuthLayout>
  );
}
