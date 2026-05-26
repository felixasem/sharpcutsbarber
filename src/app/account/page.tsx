import { Suspense } from "react";
import { AccountContent } from "./AccountContent";

export default function AccountPage() {
  return (
    <Suspense>
      <AccountContent />
    </Suspense>
  );
}
