import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function Account() {
  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl px-4 py-16">
        <h1 className="text-4xl font-bold text-primary">Account</h1>
        <p className="mt-4 text-lg text-text-primary">
          Manage your profile and subscription.
        </p>
      </div>
    </ProtectedRoute>
  );
}
