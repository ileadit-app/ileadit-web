import type { Metadata } from "next";
import { AccountDeletionView } from "@/components/legal/AccountDeletionView";

export const metadata: Metadata = {
  title: "Delete your account | ileadit",
  description: "You can delete your ileadit account and the data attached to it at any time.",
};

/**
 * WEB-LEGAL-1. Public — deliberately NOT behind `<ProtectedRoute>`. This
 * route exists because Google Play requires a web-accessible account-
 * deletion page for any app that supports account creation, and that page
 * has to work for someone who no longer has (or never has) the app
 * installed, so it cannot assume a signed-in session.
 *
 * Thin server wrapper only, so this file can export `metadata` — the real
 * page (useState/useUser, so it has to be a client component) lives in
 * `AccountDeletionView.tsx`. See that file's header comment for the
 * approved-copy source and the "still a request route, not a delete
 * button" reasoning.
 */
export default function AccountDeletion() {
  return <AccountDeletionView />;
}
