"use client";
import { useSearchParams } from "next/navigation";
import { FriendsHub, normalizeFriendDestination } from "@/components/friends/FriendsHub";
export function FriendsHubClient(){const params=useSearchParams();return <FriendsHub destination={normalizeFriendDestination(params.get("destination"))}/>;}
