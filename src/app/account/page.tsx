import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AccountView } from "@/components/account/AccountView";

export default function Account() {
  return (
    <ProtectedRoute>
      <AccountView />
    </ProtectedRoute>
  );
}
