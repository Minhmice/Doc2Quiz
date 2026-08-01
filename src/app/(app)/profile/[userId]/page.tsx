import { FriendProfilePageClient } from "@/components/profile/FriendProfilePageClient";

export default async function FriendProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  return <FriendProfilePageClient userId={(await params).userId} />;
}
