import { Suspense } from "react";
import { FriendsHubClient } from "./FriendsHubClient";
export default function FriendsPage(){return <Suspense fallback={<p className="p-6">Loading…</p>}><FriendsHubClient/></Suspense>;}
