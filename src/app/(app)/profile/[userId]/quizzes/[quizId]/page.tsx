import { FriendSharedQuizPractice } from "@/components/profile/FriendSharedQuizPractice";

export default async function FriendSharedQuizPage({
  params,
}: {
  params: Promise<{ userId: string; quizId: string }>;
}) {
  const { userId, quizId } = await params;
  return <FriendSharedQuizPractice userId={userId} quizId={quizId} />;
}
