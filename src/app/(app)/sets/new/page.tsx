import { redirect } from "next/navigation";
import { newRoot } from "@/lib/routes/studySetPaths";

export default function LegacyNewStudySetRedirectPage() {
  redirect(newRoot());
}
