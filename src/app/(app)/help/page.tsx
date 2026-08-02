"use client";

import { CircleHelp, Keyboard, Route } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import { Card, CardContent } from "@/components/ui/card";

export default function HelpPage() {
  const { messages } = useLocale();
  const n = messages.navigation;
  const help = messages.help;
  return <div className="mx-auto w-full max-w-4xl space-y-8"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Doc2Quiz</p><h2 className="mt-2 font-heading text-3xl font-extrabold tracking-tight">{n.help}</h2><p className="mt-2 max-w-2xl text-muted-foreground">{help.intro}</p></div><div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><Route className="size-6 text-[color:var(--d2q-accent)]" aria-hidden /><h3 className="mt-4 font-bold">{help.workflow}</h3><p className="mt-2 text-sm text-muted-foreground">{help.workflowBody}</p></CardContent></Card><Card><CardContent className="p-5"><Keyboard className="size-6 text-[color:var(--d2q-accent)]" aria-hidden /><h3 className="mt-4 font-bold">{help.shortcuts}</h3><p className="mt-2 text-sm text-muted-foreground">{help.shortcutsBody}</p></CardContent></Card><Card><CardContent className="p-5"><CircleHelp className="size-6 text-[color:var(--d2q-accent)]" aria-hidden /><h3 className="mt-4 font-bold">{help.faq}</h3><p className="mt-2 text-sm text-muted-foreground">{help.faqBody}</p></CardContent></Card></div></div>;
}
