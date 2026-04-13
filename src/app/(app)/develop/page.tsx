import type { Metadata } from "next";
import { DevelopLabClient } from "@/components/develop/DevelopLabClient";

export const metadata: Metadata = {
  title: "Develop",
};

export default function DevelopPage() {
  return <DevelopLabClient />;
}
