"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getLatestQuizSession, hasMistakesForStudySet } from "@/lib/client/activityTracking";
import { quizDrillMistakes, quizEdit, quizPlay } from "@/lib/routes/studySetPaths";
import { useEffect, useState } from "react";
export default function QuizResultsPage(){ const {setId}=useParams<{setId:string}>(); const [score,setScore]=useState<{correct:number;total:number}|null>(null); const [mistakes,setMistakes]=useState(false); useEffect(()=>{void getLatestQuizSession(setId).then(setScore); void hasMistakesForStudySet(setId).then(setMistakes)},[setId]); return <div className="mx-auto w-full max-w-3xl space-y-6"><h1 className="font-heading text-3xl font-extrabold">Results</h1><p className="text-2xl font-bold">{score ? `${score.correct} / ${score.total} correct` : "Loading…"}</p><div className="flex flex-wrap gap-3">{mistakes&&<Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href={quizDrillMistakes(setId)}>Drill mistakes</Link>}<Link className="rounded-md border border-border px-4 py-2" href={quizPlay(setId)}>Retry</Link><Link className="rounded-md border border-border px-4 py-2" href={quizEdit(setId)}>Edit</Link><Link className="rounded-md border border-border px-4 py-2" href="/dashboard">Dashboard</Link></div></div>; }
