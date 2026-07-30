"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useLocale } from "@/components/locale/LocaleProvider";
import { Button } from "@/components/ui/button";
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

  const [inviteOpen, setInviteOpen] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>("editor");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);

  const [pendingShareUrl, setPendingShareUrl] = useState<string | null>(null);
  const [shareActionPending, setShareActionPending] = useState(false);

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
    try {
      const created = await createWorkspaceShare(workspaceId, {
        targetKind: "workspace",
        targetId: workspaceId,
      });
      setPendingShareUrl(created.shareUrl);
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
      setLiveStatus(panel.shareLinkCopied);
      setPendingShareUrl(null);
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
      className="space-y-4"
      aria-labelledby="workspace-collaboration-heading"
      data-workspace-id={workspaceId}
      data-membership-role={membershipRole}
    >
      <div>
        <h2
          id="workspace-collaboration-heading"
          className="font-heading text-xl font-bold"
        >
          {panel.heading}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isOwner ? panel.ownerDescription : panel.readOnlyNotice}
        </p>
      </div>

      <div
        className="text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {liveStatus}
      </div>

      {!isOwner ? null : (
        <>
          {loading ? (
            <p className="text-sm text-muted-foreground" role="status">
              {panel.loading}
            </p>
          ) : null}

          {panelError ? (
            <p className="text-sm text-destructive" role="alert">
              {panelError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              ref={inviteTriggerRef}
              type="button"
              onClick={() => setInviteOpen(true)}
            >
              {panel.inviteButton}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={shareActionPending}
              onClick={() => void handleCreateWorkspaceShare()}
            >
              {panel.createWorkspaceShare}
            </Button>
            {pendingShareUrl ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCopyShareLink()}
              >
                {panel.copyShareLink}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{panel.membersHeading}</h3>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">{panel.emptyMembers}</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((member) => (
                    <li
                      key={member.userId}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {panel.memberUserId(member.userId)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabels[member.role as WorkspaceMemberRole] ??
                            roleLabels.owner}
                        </p>
                      </div>
                      {member.role === "owner" ? null : (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-xs text-muted-foreground">
                            {panel.changeRole}
                            <select
                              className="ml-2 rounded-md border border-input px-2 py-1 text-sm"
                              value={member.role}
                              onChange={(event) =>
                                void handleMemberRoleChange(
                                  member.userId,
                                  event.target.value as WorkspaceMemberRole,
                                )
                              }
                            >
                              <option value="editor">{roleLabels.editor}</option>
                              <option value="viewer">{roleLabels.viewer}</option>
                            </select>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setRevokeTarget({
                                kind: "member",
                                userId: member.userId,
                              })
                            }
                          >
                            {panel.revokeMember}
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{panel.invitationsHeading}</h3>
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {panel.emptyInvitations}
                </p>
              ) : (
                <ul className="space-y-2">
                  {invitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {panel.memberUserId(invitation.recipientUserId)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabels[invitation.role]} ·{" "}
                          {invitationStatusLabel(invitation, invitationLabels)}
                        </p>
                      </div>
                      {!invitation.acceptedAt && !invitation.revokedAt ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRevokeTarget({
                              kind: "invitation",
                              invitationId: invitation.id,
                            })
                          }
                        >
                          {panel.revokeInvitation}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{panel.sharesHeading}</h3>
              {shares.length === 0 ? (
                <p className="text-sm text-muted-foreground">{panel.emptyShares}</p>
              ) : (
                <ul className="space-y-2">
                  {shares.map((share) => (
                    <li
                      key={share.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {panel.shareTarget(share.targetKind)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {share.permission}
                          {share.revokedAt ? ` · ${invitationLabels.revoked}` : ""}
                        </p>
                      </div>
                      {!share.revokedAt ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRevokeTarget({ kind: "share", shareId: share.id })
                          }
                        >
                          {panel.revokeShare}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
        <DialogContent aria-describedby="invite-dialog-description">
          <DialogHeader>
            <DialogTitle>{panel.inviteDialogTitle}</DialogTitle>
            <DialogDescription id="invite-dialog-description">
              {panel.ownerDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span>{panel.recipientUserIdLabel}</span>
              <Input
                value={recipientUserId}
                onChange={(event) => setRecipientUserId(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>{panel.roleLabel}</span>
              <select
                className="h-8 w-full rounded-lg border border-input px-2 text-sm"
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as WorkspaceMemberRole)
                }
              >
                <option value="editor">{roleLabels.editor}</option>
                <option value="viewer">{roleLabels.viewer}</option>
              </select>
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
