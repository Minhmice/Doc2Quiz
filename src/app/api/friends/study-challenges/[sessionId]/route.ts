import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/requireApiUser";
import { declineStudyChallenge,getStudyChallenge,mapStudyTogetherRouteError } from "@/lib/server/friends/studyTogether";
const run=async(fn:(s:unknown,id:string)=>Promise<unknown>,ctx:{params:Promise<{sessionId:string}>})=>{const auth=await requireApiUser();if("error" in auth)return auth.error;const {sessionId}=await ctx.params;if(!z.string().uuid().safeParse(sessionId).success)return NextResponse.json({error:"invalid"},{status:400});try{return NextResponse.json({data:await fn(auth.supabase,sessionId)});}catch(e){const m=mapStudyTogetherRouteError(e);return NextResponse.json(m?.body??{error:"social_unavailable"},{status:m?.status??500});}};
export async function GET(_r:Request,c:{params:Promise<{sessionId:string}>}){return run(getStudyChallenge as never,c);}
export async function DELETE(_r:Request,c:{params:Promise<{sessionId:string}>}){return run(declineStudyChallenge as never,c);}
export const runtime="nodejs";
