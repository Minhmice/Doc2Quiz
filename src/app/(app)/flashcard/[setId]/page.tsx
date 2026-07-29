"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FlashcardSetOverview } from "@/components/flashcards/FlashcardSetOverview";
export default function FlashcardOverviewPage(){const {setId}=useParams<{setId:string}>();return <FlashcardSetOverview studySetId={setId}/>;}
