"use client";
import { useParams } from "next/navigation";
import { PlaySession } from "@/components/quiz/QuizSession";
export default function QuizPlayPage(){ const {setId}=useParams<{setId:string}>(); return <PlaySession studySetId={setId}/>; }
