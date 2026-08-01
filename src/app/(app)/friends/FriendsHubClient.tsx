"use client";

import { useSearchParams } from "next/navigation";
import { FriendsHub, normalizeFriendDestination } from "@/components/friends/FriendsHub";

export function FriendsHubClient() {
  const params = useSearchParams();
  const studyWith = params.get("studyWith");
  return <FriendsHub destination={normalizeFriendDestination(params.get("destination"))} studyWith={studyWith} />;
}
