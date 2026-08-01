"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/components/locale/LocaleProvider";
import { sendFriendRequest, SocialRateLimitedError } from "@/lib/client/friends";
import { validateUsername } from "@/lib/profile/usernameValidation";

export function AddFriendDialog({ open, onOpenChange, onSent }: { open: boolean; onOpenChange: (open: boolean) => void; onSent: () => void }) {
  const { messages } = useLocale();
  const copy = messages.socialSafety;
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    const trimmed = username.trim();
    const validationError = validateUsername(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSending(true);
    try {
      await sendFriendRequest(trimmed, copy.requestUnavailable);
      setUsername("");
      onOpenChange(false);
      onSent();
    } catch (cause) {
      if (cause instanceof SocialRateLimitedError) {
        setError(copy.rateLimited(cause.retryAfterSeconds));
        return;
      }
      setError(cause instanceof Error ? cause.message : copy.genericError);
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.sendRequestDialogTitle}</DialogTitle>
          <DialogDescription>{copy.requestsHelp}</DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-sm font-medium">
          {copy.sendRequestUsernameLabel}
          <Input value={username} autoComplete="off" onChange={(event) => setUsername(event.target.value)} disabled={sending} />
        </label>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
          <Button type="button" disabled={sending || !username.trim()} onClick={() => void send()}>
            {copy.sendRequestSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
