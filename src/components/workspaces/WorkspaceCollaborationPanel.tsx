"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Shield,
  UserPlus,
  Users,
  Share2,
  X,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useLocale } from "@/components/locale/LocaleProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  canManageWorkspaceCollaboration,
  changeWorkspaceMemberRole,
  createWorkspaceInvitation,
  createWorkspaceShare,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  listWorkspaceShares,
  revokeWorkspaceInvitation,
  revokeWorkspaceMember,
  revokeWorkspaceShare,
  type WorkspaceInvitation,
  type WorkspaceMember,
  type WorkspaceMemberRole,
  type WorkspaceMembershipRole,
  type WorkspaceShare,
} from "@/lib/client/workspaceCollaboration";

export type WorkspaceCollaborationPanelProps = Readonly<{
  workspaceId: string;
  membershipRole: WorkspaceMembershipRole;
  presentation?: "panel" | "dialog";
}>;

type RevokeTarget =
  | { kind: "member"; userId: string }
  | { kind: "invitation"; invitationId: string }
  | { kind: "share"; shareId: string };

export async function copyShareLinkToClipboard(shareUrl: string): Promise<void> {
  if (!navigator?.clipboard?.writeText) {
    throw new Error("Clipboard is unavailable.");
  }
  const absolute = shareUrl.startsWith("http")
    ? shareUrl
    : `${window.location.origin}${shareUrl}`;
  await navigator.clipboard.writeText(absolute);
}

function invitationStatusLabel(
  invitation: WorkspaceInvitation,
  labels: {
    pending: string;
    accepted: string;
    expired: string;
    revoked: string;
  },
): string {
  if (invitation.revokedAt) return labels.revoked;
  if (invitation.acceptedAt) return labels.accepted;
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return labels.expired;
  return labels.pending;
}

export function WorkspaceCollaborationPanel({
  workspaceId,
  membershipRole,
  presentation = "panel",
}: WorkspaceCollaborationPanelProps) {
  const { messages } = useLocale();
  const panel = messages.collaboration.panel;
  const roleLabels = messages.collaboration.roles;
  const invitationLabels = messages.collaboration.invitation;

  const isOwner = canManageWorkspaceCollaboration(membershipRole);
  const inviteTriggerRef = useRef<HTMLButtonElement>(null);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [shares, setShares] = useState<WorkspaceShare[]>([]);
  const [loading, setLoading] = useState(isOwner);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"members" | "invitations" | "shares">("members");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>("editor");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);

  const [pendingShareUrl, setPendingShareUrl] = useState<string | null>(null);
  const [shareActionPending, setShareActionPending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const refreshOwnerData = useCallback(async () => {
    setPanelError(null);
    setLoading(true);
    try {
      const [nextMembers, nextInvitations, nextShares] = await Promise.all([
        listWorkspaceMembers(workspaceId),
        listWorkspaceInvitations(workspaceId),
        listWorkspaceShares(workspaceId),
      ]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
      setShares(nextShares);
    } catch (error) {
      setPanelError(
        error instanceof Error ? error.message : panel.genericError,
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId, panel.genericError]);

  useEffect(() => {
    if (!isOwner) return;
    void refreshOwnerData();
  }, [isOwner, refreshOwnerData]);

  const handleInviteOpenChange = (open: boolean) => {
    setInviteOpen(open);
    if (!open) {
      setInviteError(null);
      setRecipientUserId("");
      setInviteRole("editor");
      inviteTriggerRef.current?.focus();
    }
  };

  const submitInvite = async () => {
    setInviteError(null);
    setInviteSubmitting(true);
    try {
      await createWorkspaceInvitation(workspaceId, {
        recipientUserId: recipientUserId.trim(),
        role: inviteRole,
      });
      setLiveStatus(invitationLabels.sent);
      handleInviteOpenChange(false);
      setRecipientUserId("");
      await refreshOwnerData();
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : panel.genericError,
      );
    } finally {
      setInviteSubmitting(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevokeSubmitting(true);
    setPanelError(null);
    try {
      if (revokeTarget.kind === "member") {
        await revokeWorkspaceMember(workspaceId, revokeTarget.userId);
      } else if (revokeTarget.kind === "invitation") {
        await revokeWorkspaceInvitation(workspaceId, revokeTarget.invitationId);
      } else {
        await revokeWorkspaceShare(workspaceId, revokeTarget.shareId);
        setPendingShareUrl(null);
      }
      setRevokeTarget(null);
      await refreshOwnerData();
    } catch (error) {
      setPanelError(
        error instanceof Error ? error.message : panel.genericError,
      );
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const handleMemberRoleChange = async (
    userId: string,
    role: WorkspaceMemberRole,
  ) => {
    setPanelError(null);
    try {
      await changeWorkspaceMemberRole(workspaceId, userId, role);
      await refreshOwnerData();
    } catch (error) {
      setPanelError(
        error instanceof Error ? error.message : panel.genericError,
      );
    }
  };

  const handleCreateWorkspaceShare = async () => {
    setShareActionPending(true);
    setPanelError(null);
    setPendingShareUrl(null);
    setCopiedLink(false);
    try {
      const created = await createWorkspaceShare(workspaceId, {
        targetKind: "workspace",
        targetId: workspaceId,
      });
      setPendingShareUrl(created.shareUrl);
      try {
        await copyShareLinkToClipboard(created.shareUrl);
        setCopiedLink(true);
        setLiveStatus(panel.shareLinkCopied);
      } catch {
        // Fallback to manual button copy
      }
      await refreshOwnerData();
    } catch (error) {
      setPanelError(
        error instanceof Error ? error.message : panel.genericError,
      );
    } finally {
      setShareActionPending(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!pendingShareUrl) return;
    try {
      await copyShareLinkToClipboard(pendingShareUrl);
      setCopiedLink(true);
      setLiveStatus(panel.shareLinkCopied);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (error) {
      setPanelError(
        error instanceof Error ? error.message : panel.genericError,
      );
    }
  };

  const revokeDialogCopy = (() => {
    if (!revokeTarget) return null;
    if (revokeTarget.kind === "member") {
      return {
        title: panel.revokeMemberConfirmTitle,
        description: panel.revokeMemberConfirmDescription,
      };
    }
    if (revokeTarget.kind === "invitation") {
      return {
        title: panel.revokeInvitationConfirmTitle,
        description: panel.revokeInvitationConfirmDescription,
      };
    }
    return {
      title: panel.revokeShareConfirmTitle,
      description: panel.revokeShareConfirmDescription,
    };
  })();

  return (
    <section
      className={presentation === "dialog" ? "space-y-5" : "space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-2xs"}
      aria-labelledby="workspace-collaboration-heading"
      data-workspace-id={workspaceId}
      data-membership-role={membershipRole}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-label text-[10px] font-bold text-primary tracking-widest flex items-center gap-1.5">
            <Shield className="size-3.5" />
            Access & Sharing
          </p>
          <h2
            id="workspace-collaboration-heading"
            className="font-heading text-lg font-bold text-foreground"
          >
            {panel.heading}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {isOwner ? panel.ownerDescription : panel.readOnlyNotice}
          </p>
        </div>
      </div>

      {/* Status Live Notification */}
      <div
        className="text-xs text-muted-foreground font-medium"
        role="status"
        aria-live="polite"
      >
        {liveStatus ? (
          <span className="inline-flex items-center gap-1.5 text-chart-2 font-semibold bg-chart-2/10 px-2.5 py-1 rounded-md">
            <Check className="size-3.5" />
            {liveStatus}
          </span>
        ) : null}
      </div>

      {!isOwner ? null : (
        <>
          {loading ? (
            <p className="text-xs text-muted-foreground animate-pulse" role="status">
              {panel.loading}
            </p>
          ) : null}

          {panelError ? (
            <Alert variant="destructive" className="py-2.5">
              <AlertDescription className="text-xs font-semibold">{panelError}</AlertDescription>
            </Alert>
          ) : null}

          {/* Quick Invite & Share Action Bar */}
          <div className="space-y-3 rounded-lg border border-border/50 bg-background/60 p-3">
            <p className="text-[10px] font-semibold text-foreground flex items-center gap-1.5">
              <UserPlus className="size-3.5 text-primary" />
              Quick Member Invite
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="User ID or email address..."
                value={recipientUserId}
                onChange={(e) => setRecipientUserId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && recipientUserId.trim()) {
                    void submitInvite();
                  }
                }}
                className="h-8 text-xs bg-background shrink"
              />
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as WorkspaceMemberRole)}>
                <SelectTrigger size="sm" className="h-8 min-w-24 shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="editor">{roleLabels.editor}</SelectItem>
                    <SelectItem value="viewer">{roleLabels.viewer}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                ref={inviteTriggerRef}
                type="button"
                size="sm"
                className="h-8 text-xs font-medium gap-1 shrink-0 shadow-2xs"
                disabled={inviteSubmitting || recipientUserId.trim().length === 0}
                onClick={() => void submitInvite()}
              >
                <UserPlus className="size-3.5" />
                {panel.inviteButton}
              </Button>
            </div>

            {inviteError ? (
              <p className="text-[10px] font-medium text-destructive">{inviteError}</p>
            ) : null}

            {/* Quick Share Link Trigger */}
            <div className="pt-2 border-t border-border/40 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium gap-1.5 w-full"
                disabled={shareActionPending}
                onClick={() => void handleCreateWorkspaceShare()}
              >
                <Link2 className="size-3.5 text-primary" />
                {panel.createWorkspaceShare}
              </Button>

              {/* Created Share Link Banner */}
              {pendingShareUrl ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex items-center justify-between gap-2 transition-all">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-primary flex items-center gap-1">
                      <Sparkles className="size-3" />
                      Share Link Ready
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-45">
                      {pendingShareUrl}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={copiedLink ? "default" : "secondary"}
                    size="sm"
                    className="h-7 text-xs font-medium gap-1 shrink-0"
                    onClick={() => void handleCopyShareLink()}
                  >
                    {copiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copiedLink ? "Copied!" : panel.copyShareLink}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Segmented View Tabs */}
          <div className="space-y-3 pt-1">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
              <TabsList className="w-full border border-border/50 bg-muted/60 text-xs">
                <TabsTrigger value="members" className="gap-1.5 text-xs"><Users data-icon="inline-start" /><span>{panel.membersHeading}</span><Badge variant="secondary" className="min-w-4 px-1.5 py-0 text-[10px]">{members.length}</Badge></TabsTrigger>
                <TabsTrigger value="invitations" className="gap-1.5 text-xs"><UserPlus data-icon="inline-start" /><span>Invites</span><Badge variant="secondary" className="min-w-4 px-1.5 py-0 text-[10px]">{invitations.length}</Badge></TabsTrigger>
                <TabsTrigger value="shares" className="gap-1.5 text-xs"><Share2 data-icon="inline-start" /><span>Shares</span><Badge variant="secondary" className="min-w-4 px-1.5 py-0 text-[10px]">{shares.length}</Badge></TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Tab 1: Members */}
            {activeTab === "members" ? (
              <div className="space-y-2">
                <h3 className="sr-only">{panel.membersHeading}</h3>
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">{panel.emptyMembers}</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((member) => {
                      const isMemberOwner = member.role === "owner";
                      return (
                        <li
                          key={member.userId}
                          className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-semibold text-foreground wrap-anywhere">
                              {panel.memberUserId(member.userId)}
                            </p>
                            <Badge
                              variant={isMemberOwner ? "default" : member.role === "editor" ? "secondary" : "outline"}
                              className="text-[10px] font-medium capitalize"
                            >
                              {roleLabels[member.role as WorkspaceMemberRole] ?? roleLabels.owner}
                            </Badge>
                          </div>

                          {!isMemberOwner ? (
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {panel.changeRole}
                                <Select value={member.role} onValueChange={(value) => void handleMemberRoleChange(member.userId, value as WorkspaceMemberRole)}>
                                  <SelectTrigger size="sm" className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectGroup><SelectItem value="editor">{roleLabels.editor}</SelectItem><SelectItem value="viewer">{roleLabels.viewer}</SelectItem></SelectGroup></SelectContent>
                                </Select>
                              </label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() =>
                                  setRevokeTarget({
                                    kind: "member",
                                    userId: member.userId,
                                  })
                                }
                              >
                                <Trash2 className="size-3 mr-1" />
                                {panel.revokeMember}
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}

            {/* Tab 2: Invitations */}
            {activeTab === "invitations" ? (
              <div className="space-y-2">
                <h3 className="sr-only">{panel.invitationsHeading}</h3>
                {invitations.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    {panel.emptyInvitations}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {invitations.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-semibold text-foreground wrap-anywhere">
                            {panel.memberUserId(invitation.recipientUserId)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {roleLabels[invitation.role]} ·{" "}
                            {invitationStatusLabel(invitation, invitationLabels)}
                          </p>
                        </div>
                        {!invitation.acceptedAt && !invitation.revokedAt ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs shrink-0 self-end sm:self-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setRevokeTarget({
                                kind: "invitation",
                                invitationId: invitation.id,
                              })
                            }
                          >
                            <X className="size-3 mr-1" />
                            {panel.revokeInvitation}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {/* Tab 3: Shares */}
            {activeTab === "shares" ? (
              <div className="space-y-2">
                <h3 className="sr-only">{panel.sharesHeading}</h3>
                {shares.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">{panel.emptyShares}</p>
                ) : (
                  <ul className="space-y-2">
                    {shares.map((share) => (
                      <li
                        key={share.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-semibold text-foreground wrap-anywhere">
                            {panel.shareTarget(share.targetKind)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {share.permission}
                            {share.revokedAt ? ` · ${invitationLabels.revoked}` : ""}
                          </p>
                        </div>
                        {!share.revokedAt ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs shrink-0 self-end sm:self-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setRevokeTarget({ kind: "share", shareId: share.id })
                            }
                          >
                            <Trash2 className="size-3 mr-1" />
                            {panel.revokeShare}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* Accessible Invite Modal Dialog (Kept fully functional) */}
      <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
        <DialogContent aria-describedby="invite-dialog-description">
          <DialogHeader>
            <DialogTitle>{panel.inviteDialogTitle}</DialogTitle>
            <DialogDescription id="invite-dialog-description">
              {panel.ownerDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span>{panel.recipientUserIdLabel}</span>
              <Input
                value={recipientUserId}
                onChange={(event) => setRecipientUserId(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span>{panel.roleLabel}</span>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as WorkspaceMemberRole)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem value="editor">{roleLabels.editor}</SelectItem><SelectItem value="viewer">{roleLabels.viewer}</SelectItem></SelectGroup></SelectContent>
              </Select>
            </label>
            <div
              className="text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {inviteError ? (
                <span className="text-destructive">{inviteError}</span>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleInviteOpenChange(false)}
            >
              {panel.cancel}
            </Button>
            <Button
              type="button"
              disabled={inviteSubmitting || recipientUserId.trim().length === 0}
              onClick={() => void submitInvite()}
            >
              {panel.sendInvite}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accessible Revoke Confirmation Alert Dialog */}
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{revokeDialogCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeDialogCopy?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeSubmitting}>
              {panel.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeSubmitting}
              onClick={() => void confirmRevoke()}
            >
              {panel.confirmRevoke}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

