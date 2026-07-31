"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listAcceptedFriendPage, listBlockedUserPage, listFriendRequestPage, type Page } from "@/lib/client/friends";
import { listConversationPage } from "@/lib/client/messages";
import { listStudyChallenges } from "@/lib/client/studyTogether";

export const FRIEND_DESTINATIONS=["friends","requests","invites","messages","blocked"] as const;
export type FriendDestination=typeof FRIEND_DESTINATIONS[number];
export const normalizeFriendDestination=(value:string|null):FriendDestination=>FRIEND_DESTINATIONS.includes(value as FriendDestination)?value as FriendDestination:"friends";
const labels:Record<FriendDestination,string>={friends:"Friends",requests:"Requests",invites:"Invites",messages:"Messages",blocked:"Blocked"};
const id=(d:FriendDestination,row:Record<string,unknown>)=>String(row[d==="friends"||d==="blocked"?"userId":d==="requests"?"requestId":d==="invites"?"sessionId":"conversationId"]);

export function FriendsHub({destination}:{destination:FriendDestination}){
 const [page,setPage]=useState<Page<Record<string,unknown>>>({items:[],nextCursor:null,hasMore:false}); const [state,setState]=useState<"loading"|"ready"|"error">("loading");
 const load=async(cursor?:string)=>{setState("loading");try{const next=await (destination==="friends"?listAcceptedFriendPage(cursor):destination==="requests"?listFriendRequestPage("incoming",cursor):destination==="invites"?listStudyChallenges(cursor):destination==="messages"?listConversationPage(cursor):listBlockedUserPage(cursor)) as Page<Record<string,unknown>>;setPage(old=>cursor?{...next,items:[...old.items,...next.items.filter(row=>!old.items.some(item=>id(destination,item)===id(destination,row)))]}:next);setState("ready");}catch{setState("error");}};
 useEffect(()=>{void load();},[destination]);
 return <main className="mx-auto w-full max-w-5xl min-w-0 px-4 py-6 sm:px-6"><h1 className="text-2xl font-bold">Friends</h1><nav aria-label="Friends destinations" className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-2">{FRIEND_DESTINATIONS.map(d=><Link key={d} href={`/friends?destination=${d}`} aria-current={d===destination?"page":undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm ${d===destination?"bg-primary text-primary-foreground":"bg-muted"}`}>{labels[d]}</Link>)}</nav><section aria-live="polite" className="mt-6 space-y-3">{state==="loading"&&!page.items.length?<p>Loading…</p>:null}{state==="error"?<button onClick={()=>void load()} className="rounded-md border px-4 py-2">Retry</button>:null}{state==="ready"&&!page.items.length?<p className="text-muted-foreground">Nothing here yet.</p>:page.items.map(row=><article key={id(destination,row)} className="min-w-0 rounded-xl border bg-card p-4"><p className="truncate font-medium">{String(row.username??row.title??row.preview??"Study friend")}</p>{destination==="messages"?<Link className="text-sm text-primary" href={`/friends/messages/${row.conversationId}`}>Open conversation</Link>:null}</article>)}{page.hasMore&&page.nextCursor?<button onClick={()=>void load(page.nextCursor!)} disabled={state==="loading"} className="rounded-md border px-4 py-2">Load more</button>:page.items.length?<p className="text-sm text-muted-foreground">End of list</p>:null}</section></main>;
}
