"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Link2, LockKeyhole, Mail, MoreHorizontal, Settings2, Share2, Users } from "lucide-react";

import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWorkspaceDetail } from "@/lib/client/workspaceApi";
import {
  copyShareLinkToClipboard,
  createWorkspaceInvitation,
  createWorkspaceShare,
  listWorkspaceMembers,
  type WorkspaceMember,
  type WorkspaceMemberRole,
} from "@/lib/client/workspaceCollaboration";
import type { WorkspaceRole } from "@/lib/workspaces/workspaceSummary";

function displayMember(member: WorkspaceMember) {
  return member.userId.includes("@") ? member.userId : `Member ${member.userId.slice(0, 8)}`;
}

export function WorkspaceTopBarActions({ workspaceId }: { workspaceId: string }) {
  const [sharingOpen, setSharingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membershipRole, setMembershipRole] = useState<WorkspaceRole | null>(null);
  const [workspaceTitle, setWorkspaceTitle] = useState("Workspace");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [recipient, setRecipient] = useState("");
  const [role, setRole] = useState<WorkspaceMemberRole>("editor");
  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const isOwner = membershipRole === "owner";
  const refreshMembers = async () => {
    if (!isOwner) return;
    const nextMembers = await listWorkspaceMembers(workspaceId);
    setMembers(nextMembers);
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchWorkspaceDetail(workspaceId, { signal: controller.signal })
      .then((workspace) => {
        setMembershipRole(workspace.role);
        setWorkspaceTitle(workspace.title);
      })
      .catch(() => setMembershipRole(null));
    return () => controller.abort();
  }, [workspaceId]);

  useEffect(() => {
    if (sharingOpen) void refreshMembers().catch(() => setStatus("Could not load collaborators."));
  }, [sharingOpen, membershipRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async () => {
    if (!recipient.trim()) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await createWorkspaceInvitation(workspaceId, { recipientUserId: recipient.trim(), role });
      setRecipient("");
      setStatus("Invitation sent.");
      await refreshMembers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    setSubmitting(true);
    setStatus(null);
    try {
      const url = shareUrl ?? (await createWorkspaceShare(workspaceId, { targetKind: "workspace", targetId: workspaceId })).shareUrl;
      setShareUrl(url);
      await copyShareLinkToClipboard(url);
      setStatus("Link copied.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 border-r border-border/60 pr-2">
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 px-3 sm:px-3.5" onClick={() => setSharingOpen(true)}>
          <Share2 className="size-4" /><span className="hidden sm:inline">Share</span><span className="sr-only sm:hidden">Share workspace</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-sm" className="size-9" aria-label="More workspace options" />}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings2 className="size-4" /> Workspace settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={sharingOpen} onOpenChange={setSharingOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-5 py-5 pr-12 sm:px-9 sm:py-8">
            <DialogTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">Share “{workspaceTitle}”</DialogTitle>
            <DialogDescription className="sr-only">Invite people and manage workspace access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-7 px-5 py-6 sm:px-9 sm:py-7">
            {isOwner ? (
              <div className="space-y-3">
                <label className="sr-only" htmlFor="workspace-recipient">Add people</label>
                <Input id="workspace-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void invite(); }} placeholder="Add people by user ID or email" className="h-12 text-base" />
                <div className="flex flex-wrap justify-end gap-2">
                  <Select value={role} onValueChange={(value) => setRole(value as WorkspaceMemberRole)}>
                    <SelectTrigger className="h-10 min-w-24 text-sm font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup><SelectItem value="editor">Editor</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectGroup></SelectContent>
                  </Select>
                  <Button type="button" className="h-10" disabled={!recipient.trim() || submitting} onClick={() => void invite()}>Send</Button>
                </div>
              </div>
            ) : null}

            <section aria-labelledby="people-with-access" className="space-y-3">
              <div className="flex items-center justify-between gap-3"><h2 id="people-with-access" className="text-lg font-semibold">People with access</h2><div className="flex gap-1 text-muted-foreground"><Copy className="size-5" /><Mail className="size-5" /></div></div>
              <div className="divide-y divide-border">
                {members.map((member) => <div key={member.userId} className="flex min-h-16 items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold"><Users className="size-4" /></div><p className="truncate font-medium">{displayMember(member)}</p></div><span className="shrink-0 text-sm text-muted-foreground">{member.role === "owner" ? "Owner" : member.role === "editor" ? "Editor" : "Viewer"}</span></div>)}
                {members.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Only you have access.</p> : null}
              </div>
            </section>

            <section aria-labelledby="general-access" className="space-y-3"><h2 id="general-access" className="text-lg font-semibold">General access</h2><div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-full bg-muted"><LockKeyhole className="size-5" /></div><div className="min-w-0"><Button type="button" variant="ghost" size="sm" className="h-auto gap-1 p-0 font-medium" aria-label="General access is restricted">Restricted <ChevronDown className="size-4" /></Button><p className="mt-1 text-sm text-muted-foreground">Only people with access can open this workspace link.</p></div></div></section>
            {status ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p> : null}
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-9"><Button type="button" variant="outline" className="h-11 gap-2 sm:w-auto" disabled={submitting} onClick={() => void copyLink()}>{status === "Link copied." ? <Check className="size-4" /> : <Link2 className="size-4" />}{status === "Link copied." ? "Copied link" : "Copy link"}</Button><Button type="button" className="h-11" onClick={() => setSharingOpen(false)}>Done</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Workspace settings</DialogTitle><DialogDescription>Workspace controls stay separate from study content and sharing.</DialogDescription></DialogHeader><div className="divide-y divide-border rounded-lg border border-border"><div className="p-4"><p className="font-medium">Workspace details</p><p className="mt-1 text-sm text-muted-foreground">Rename workspace, edit description, and manage visibility.</p></div><div className="p-4"><p className="font-medium">Source defaults</p><p className="mt-1 text-sm text-muted-foreground">Choose default generation language, question style, and source behavior.</p></div><div className="p-4"><p className="font-medium">Danger zone</p><p className="mt-1 text-sm text-muted-foreground">Archive workspace or permanently delete its content.</p></div></div></DialogContent></Dialog>
    </>
  );
}
