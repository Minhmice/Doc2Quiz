"use client";
import { useParams } from "next/navigation";
import { FlashcardSession } from "@/components/flashcards/FlashcardSession";
export default function FlashcardPlayPage(){const {setId}=useParams<{setId:string}>(); return <FlashcardSession studySetId={setId}/>;}
