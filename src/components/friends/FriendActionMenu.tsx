"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag, MessageCircle, Sparkles, UserMinus, UserRound, UsersRound } from "lucide-react";

import { useLocale } from "@/components/locale/LocaleProvider";
import { friendProfileHref } from "@/lib/profile/usernameValidation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { blockUser, removeFriend, reportUser } from "@/lib/client/friends";
import { PRESET_REACTION_IDS, sendPresetReaction, type PresetReactionId } from "@/lib/client/messages";
import type { PresenceBucket } from "@/lib/social/presenceTypes";

const reactions: Record<PresetReactionId, string> = { xin_chao: "Ê, tập trung học nè!", co_len: "Đừng để điểm số chạy mất!", dinh_qua: "Làm một câu nữa đi!", qua_hay: "Nghỉ chút rồi chiến tiếp!", ban_gioi: "Quiz đang đợi kìa!", thu_gian: "Bạn làm được mà!", good_luck: "Cố lên nhé!", tuyet_voi: "Tuyệt vời!" };

type DestructiveAction = "remove" | "block";

export function getFriendPresencePresentation(presence: PresenceBucket) {
  const isOnline = presence === "online";
  return { isOnline, showOnlineAffordance: isOnline };
}

export function FriendActionMenu({ userId, username, avatarUrl, presence, onStudyTogether, onMessage, onRefresh, onStatus }: { userId: string; username: string | null; avatarUrl: string | null; presence: PresenceBucket; onStudyTogether: () => void; onMessage: () => void; onRefresh: () => void; onStatus: (status: string) => void }) {
  const router = useRouter();
  const { messages } = useLocale();
  const copy = messages.friendActions;
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction | null>(null);
  const [busy, setBusy] = useState(false);
  const { isOnline } = getFriendPresencePresentation(presence);
  const presenceLabel = isOnline ? copy.online : null;

  const confirm = async () => {
    if (!destructiveAction) return;
    setBusy(true);
    try {
      if (destructiveAction === "remove") {
        await removeFriend(userId);
        onStatus(copy.removed);
      } else {
        await blockUser(userId);
        onStatus(copy.blocked);
      }
      setDestructiveAction(null);
      onRefresh();
    } catch {
      onStatus(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    try {
      await reportUser(userId, "other");
      onStatus(copy.reported);
    } catch {
      onStatus(copy.failed);
    }
  };

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-none focus:bg-accent">
        <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground">{avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : (username?.[0]?.toUpperCase() ?? "?")}</span>
        {isOnline ? <span className="size-2 rounded-full bg-muted-foreground" /> : null}
        <span>{username ?? "Study buddy"}{presenceLabel ? <small className="ml-2 text-xs text-muted-foreground">{presenceLabel}</small> : null}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup><DropdownMenuLabel>{username ?? "Study buddy"}</DropdownMenuLabel></DropdownMenuGroup>
        <DropdownMenuItem onClick={onStudyTogether}><UsersRound />{copy.studyTogether}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(friendProfileHref(userId, username))}><UserRound />{copy.viewProfile}</DropdownMenuItem>
        <DropdownMenuItem onClick={onMessage}><MessageCircle />{copy.message}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub><DropdownMenuSubTrigger><Sparkles />{copy.reactions}</DropdownMenuSubTrigger><DropdownMenuSubContent className="max-w-64">{PRESET_REACTION_IDS.map((reactionId) => <DropdownMenuItem key={reactionId} onClick={() => void sendPresetReaction(userId, reactionId).then(() => onStatus(copy.reported)).catch(() => onStatus(copy.failed))}>{reactions[reactionId]}</DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setDestructiveAction("remove")}><UserMinus />{copy.removeFriend}</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => setDestructiveAction("block")}><Ban />{copy.block}</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => void report()}><Flag />{copy.report}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={destructiveAction !== null} onOpenChange={(open) => { if (!open && !busy) setDestructiveAction(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{destructiveAction === "remove" ? copy.removeTitle : copy.blockTitle}</AlertDialogTitle>
          <AlertDialogDescription>{destructiveAction === "remove" ? copy.removeDescription : copy.blockDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{copy.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={() => void confirm()}>{destructiveAction === "remove" ? copy.confirmRemove : copy.confirmBlock}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
