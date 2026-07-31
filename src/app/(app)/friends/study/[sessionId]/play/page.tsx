import { StudyChallengePlayClient } from "./StudyChallengePlayClient";

export default async function StudyChallengePlayPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ attemptId?: string }> }) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  return <StudyChallengePlayClient sessionId={sessionId} attemptId={query.attemptId ?? ""} />;
}
