"use client";
import { useParams } from "next/navigation";
import { ReviewSection } from "@/components/review/ReviewSection";
export default function QuizReviewPage(){ const {setId}=useParams<{setId:string}>(); return <ReviewSection studySetId={setId}/>; }
