import{NextResponse}from"next/server";import{requireApiUser}from"@/lib/api/requireApiUser";import{getUnreadNotificationCount,mapStudyTogetherRouteError}from"@/lib/server/friends/studyTogether";
export async function GET(){const a=await requireApiUser();if("error"in a)return a.error;try{return NextResponse.json({data:{count:await getUnreadNotificationCount(a.supabase)}});}catch(e){const m=mapStudyTogetherRouteError(e);return NextResponse.json(m?.body??{error:"social_unavailable"},{status:m?.status??500});}}
export const runtime="nodejs";
