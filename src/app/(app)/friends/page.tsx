import { Suspense } from "react";
import { FriendsHubClient } from "./FriendsHubClient";
import FriendsLoading from "./loading";

export default function FriendsPage() {
  return (
    <Suspense fallback={<FriendsLoading />}>
      <FriendsHubClient />
    </Suspense>
  );
}
