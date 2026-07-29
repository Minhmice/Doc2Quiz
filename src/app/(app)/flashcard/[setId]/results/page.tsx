"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { flashcardEdit, flashcardPlay } from "@/lib/routes/studySetPaths";
export default function FlashcardResultsPage(){const {setId}=useParams<{setId:string}>();return <div className="space-y-6"><h1 className="font-heading text-3xl font-extrabold">Results</h1><p className="text-muted-foreground">Your flashcard session is complete.</p><div className="flex flex-wrap gap-3"><Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href={flashcardPlay(setId)}>Retry</Link><Link className="rounded-md border border-border px-4 py-2" href={flashcardEdit(setId)}>Edit</Link><Link className="rounded-md border border-border px-4 py-2" href="/dashboard">Dashboard</Link></div></div>;}
