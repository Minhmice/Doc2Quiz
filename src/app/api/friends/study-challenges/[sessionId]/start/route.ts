import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/requireApiUser";
import { mapStudyTogetherRouteError,startStudyChallengeAttempt } from "@/lib/server/friends/studyTogether";
export async function POST(_request:Request,ctx:{params:Promise<{sessionId:string}>}){const auth=await requireApiUser();if("error" in auth)return auth.error;const {sessionId}=await ctx.params;if(!z.string().uuid().safeParse(sessionId).success)return NextResponse.json({error:"invalid"},{status:400});try{const a=await startStudyChallengeAttempt(auth.supabase,sessionId);return NextResponse.json({data:{attemptId:a.attemptId,playHref:`/friends/study/${sessionId}/play?attemptId=${a.attemptId}`}});}catch(e){const m=mapStudyTogetherRouteError(e);return NextResponse.json(m?.body??{error:"social_unavailable"},{status:m?.status??500});}}
export const runtime="nodejs";
