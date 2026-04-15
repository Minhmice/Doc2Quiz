"use client";

import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type DevelopPreviewBatch03FormsProps = Readonly<Record<string, never>>;

export function DevelopPreviewBatch03Forms(
  {}: Readonly<DevelopPreviewBatch03FormsProps>,
) {
  const nameId = useId();
  const notesId = useId();
  const agreeId = useId();
  const notifyId = useId();
  const topicId = useId();

  const [topic, setTopic] = useState("review");
  const [notify, setNotify] = useState(true);
  const [agree, setAgree] = useState(false);

  return (
    <section id="develop-preview-forms" className="space-y-4">
      <h2 className="font-heading text-lg font-semibold tracking-tight">Forms</h2>
      <div className="grid max-w-xl gap-6">
        <div className="space-y-2">
          <Label htmlFor={nameId}>Name</Label>
          <Input id={nameId} placeholder="Ada Lovelace" autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={notesId}>Notes</Label>
          <Textarea id={notesId} placeholder="Optional context…" rows={3} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={agreeId}
            checked={agree}
            onCheckedChange={(checked) => setAgree(checked)}
          />
          <Label htmlFor={agreeId} className="font-normal text-muted-foreground">
            I agree to preview-only controls
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={notifyId}
            checked={notify}
            onCheckedChange={(checked) => setNotify(checked)}
          />
          <Label htmlFor={notifyId} className="font-normal text-muted-foreground">
            Show notifications
          </Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor={topicId}>Topic</Label>
          <Select
            value={topic}
            onValueChange={(value) => setTopic(value ?? "review")}
          >
            <SelectTrigger id={topicId} className="w-full max-w-sm">
              <SelectValue placeholder="Choose a topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="practice">Practice</SelectItem>
              <SelectItem value="source">Source</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
