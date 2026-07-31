import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/requireApiUser";
import { createStudyChallenge, mapStudyTogetherRouteError } from "@/lib/server/friends/studyTogether";
import { parseSocialListQuery } from "@/lib/server/friends/socialListQuery";
import { listSocialInvites } from "@/lib/server/friends/socialLists";
const createSchema=z.object({recipientId:z.string().uuid(),outputId:z.string().uuid(),mode:z.enum(["practice","score"]).default("score"),deadlineAt:z.string().datetime().nullable().default(null),message:z.string().trim().max(500).nullable().default(null),revealPolicy:z.enum(["immediate","after_both_complete","after_deadline"]).default("after_both_complete")}).superRefine((v,c)=>{if(v.deadlineAt){const t=Date.parse(v.deadlineAt);if(t<=Date.now()||t>Date.now()+365*86400000)c.addIssue({code:"custom",message:"deadline"});}});
const fail=(e:unknown)=>{const m=mapStudyTogetherRouteError(e);return NextResponse.json(m?.body??{error:"social_unavailable"},{status:m?.status??500});};
export async function GET(request:Request){const auth=await requireApiUser();if("error" in auth)return auth.error;try{const q=new URL(request.url).searchParams;z.object({role:z.literal("recipient"),status:z.literal("pending")}).parse({role:q.get("role"),status:q.get("status")});const {limit,cursor}=parseSocialListQuery(q);return NextResponse.json({data:await listSocialInvites(auth.supabase,limit,cursor)});}catch(e){if(e instanceof z.ZodError||(e instanceof Error&&e.message==="social_unavailable"))return NextResponse.json({error:"invalid"},{status:400});return fail(e);}}
export async function POST(request:Request){const auth=await requireApiUser();if("error" in auth)return auth.error;let body;try{body=createSchema.parse(await request.json());}catch{return NextResponse.json({error:"invalid"},{status:400});}try{return NextResponse.json({data:await createStudyChallenge(auth.supabase,body)});}catch(e){return fail(e);}}
export const runtime="nodejs";
