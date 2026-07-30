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
import { Textarea } from "@/components/ui/textarea";
import {
  blockUser,
  cancelFriendRequest,
  fetchProfileUsername,
  listBlockedUsers,
  listFriendRequests,
  reportUser,
  respondFriendRequest,
  sendFriendRequest,
  SocialRateLimitedError,
  unblockUser,
  updateProfileUsername,
  UsernameTakenClientError,
  type BlockedUserSummary,
  type FriendRequestSummary,
} from "@/lib/client/friends";

type ConfirmTarget =
  | { kind: "block"; userId: string }
  | { kind: "unblock"; userId: string };

type ReportTarget = {
  userId: string;
};

export function SocialSafetySettings() {
  const { messages } = useLocale();
  const copy = messages.socialSafety;

  const sendRequestTriggerRef = useRef<HTMLButtonElement>(null);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);

  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [requests, setRequests] = useState<FriendRequestSummary[]>([]);
  const [blocks, setBlocks] = useState<BlockedUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  const [sendRequestOpen, setSendRequestOpen] = useState(false);
  const [requestUsername, setRequestUsername] = useState("");
  const [sendRequestSubmitting, setSendRequestSubmitting] = useState(false);
  const [sendRequestError, setSendRequestError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const mapActionError = useCallback(
    (error: unknown) => {
      if (error instanceof SocialRateLimitedError) {
        return copy.rateLimited(error.retryAfterSeconds);
      }
      if (error instanceof UsernameTakenClientError) {
        return copy.usernameTaken;
      }
      if (error instanceof Error) {
        return error.message;
      }
      return copy.genericError;
    },
    [copy],
  );

  const refreshSocialData = useCallback(async () => {
    setPanelError(null);
    setLoading(true);
    try {
      const [nextUsername, nextRequests, nextBlocks] = await Promise.all([
        fetchProfileUsername(),
        listFriendRequests(),
        listBlockedUsers(),
      ]);
      setUsername(nextUsername ?? "");
      setRequests(nextRequests);
      setBlocks(nextBlocks);
    } catch (error) {
      setPanelError(mapActionError(error));
    } finally {
      setLoading(false);
    }
  }, [mapActionError]);

  useEffect(() => {
    void refreshSocialData();
  }, [refreshSocialData]);

  const saveUsername = async () => {
    setUsernameError(null);
    setUsernameSaving(true);
    try {
      const result = await updateProfileUsername(username);
      setUsername(result.username);
      setLiveStatus(messages.toast.saved);
    } catch (error) {
      setUsernameError(mapActionError(error));
    } finally {
      setUsernameSaving(false);
    }
  };

  const handleSendRequestOpenChange = (open: boolean) => {
    setSendRequestOpen(open);
    if (!open) {
      setSendRequestError(null);
      setRequestUsername("");
      sendRequestTriggerRef.current?.focus();
    }
  };

  const submitSendRequest = async () => {
    setSendRequestError(null);
    setSendRequestSubmitting(true);
    try {
      await sendFriendRequest(requestUsername.trim());
      handleSendRequestOpenChange(false);
      await refreshSocialData();
    } catch (error) {
      setSendRequestError(mapActionError(error));
    } finally {
      setSendRequestSubmitting(false);
    }
  };

  const handleReportOpenChange = (open: boolean) => {
    if (!open) {
      setReportError(null);
      setReportReason("");
      setReportDetails("");
      setReportTarget(null);
      reportTriggerRef.current?.focus();
    }
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    setReportError(null);
    setReportSubmitting(true);
    try {
      await reportUser(
        reportTarget.userId,
        reportReason.trim(),
        reportDetails.trim() || undefined,
      );
      setLiveStatus(copy.reportAcknowledgement);
      handleReportOpenChange(false);
    } catch (error) {
      setReportError(mapActionError(error));
    } finally {
      setReportSubmitting(false);
    }
  };

  const confirmDestructiveAction = async () => {
    if (!confirmTarget) return;
    setConfirmSubmitting(true);
    setPanelError(null);
    try {
      if (confirmTarget.kind === "block") {
        await blockUser(confirmTarget.userId);
      } else {
        await unblockUser(confirmTarget.userId);
      }
      setConfirmTarget(null);
      await refreshSocialData();
    } catch (error) {
      setPanelError(mapActionError(error));
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const respondToRequest = async (
    requestId: string,
    action: "accept" | "decline",
  ) => {
    setPanelError(null);
    try {
      await respondFriendRequest(requestId, action);
      await refreshSocialData();
    } catch (error) {
      setPanelError(mapActionError(error));
    }
  };

  const cancelOutgoingRequest = async (requestId: string) => {
    setPanelError(null);
    try {
      await cancelFriendRequest(requestId);
      await refreshSocialData();
    } catch (error) {
      setPanelError(mapActionError(error));
    }
  };

  const incomingRequests = requests.filter((request) => request.direction === "incoming");
  const outgoingRequests = requests.filter((request) => request.direction === "outgoing");

  const confirmCopy =
    confirmTarget?.kind === "block"
      ? {
          title: copy.blockConfirmTitle,
          description: copy.blockConfirmDescription,
        }
      : confirmTarget
        ? {
            title: copy.unblockConfirmTitle,
            description: copy.unblockConfirmDescription,
          }
        : null;

  return (
    <section
      id="social-safety"
      className="space-y-8"
      aria-labelledby="social-safety-heading"
      data-social-settings="true"
    >
      <div>
        <h2 id="social-safety-heading" className="font-heading text-xl font-bold tracking-tight text-foreground">
          {copy.heading}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.description}</p>
      </div>

      <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {liveStatus}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {copy.loading}
        </p>
      ) : null}

      {panelError ? (
        <p className="text-sm text-destructive" role="alert">
          {panelError}
        </p>
      ) : null}

      <section aria-labelledby="social-username-heading" className="space-y-3">
        <div>
          <h3 id="social-username-heading" className="text-base font-semibold text-foreground">
            {copy.usernameTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{copy.usernameHelp}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            aria-label={copy.usernameLabel}
            disabled={usernameSaving}
            className="min-h-11 text-base"
          />
          <Button
            type="button"
            onClick={() => void saveUsername()}
            disabled={usernameSaving || !username.trim()}
            className="min-h-11 shrink-0"
          >
            {copy.usernameSave}
          </Button>
        </div>
        {usernameError ? (
          <p className="text-sm text-destructive" role="alert">
            {usernameError}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="social-requests-heading" className="space-y-4 border-t border-border pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="social-requests-heading" className="text-base font-semibold text-foreground">
              {copy.requestsTitle}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{copy.requestsHelp}</p>
          </div>
          <Button
            ref={sendRequestTriggerRef}
            type="button"
            onClick={() => setSendRequestOpen(true)}
            className="min-h-11 shrink-0"
          >
            {copy.sendRequestButton}
          </Button>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.emptyRequests}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{copy.incomingHeading}</h4>
              {incomingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">{copy.emptyRequests}</p>
              ) : (
                <ul className="space-y-2">
                  {incomingRequests.map((request) => (
                    <li
                      key={request.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 p-3"
                    >
                      <p className="text-sm font-medium">{copy.requestLabel(request.otherUsername)}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => void respondToRequest(request.id, "accept")}>
                          {copy.acceptRequest}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void respondToRequest(request.id, "decline")}>
                          {copy.declineRequest}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmTarget({ kind: "block", userId: request.otherUserId })}>
                          {copy.blockUser}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReportTarget({ userId: request.otherUserId });
                            setReportReason("");
                            setReportDetails("");
                          }}
                        >
                          {copy.reportUser}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{copy.outgoingHeading}</h4>
              {outgoingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">{copy.emptyRequests}</p>
              ) : (
                <ul className="space-y-2">
                  {outgoingRequests.map((request) => (
                    <li
                      key={request.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="text-sm font-medium">{copy.requestLabel(request.otherUsername)}</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => void cancelOutgoingRequest(request.id)}>
                        {copy.cancelRequest}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="social-blocks-heading" className="space-y-3 border-t border-border pt-6">
        <div>
          <h3 id="social-blocks-heading" className="text-base font-semibold text-foreground">
            {copy.blocksTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{copy.blocksHelp}</p>
        </div>
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.emptyBlocks}</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((entry) => (
              <li
                key={entry.userId}
                className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-medium">{copy.blockedLabel(entry.username)}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmTarget({ kind: "unblock", userId: entry.userId })}
                >
                  {copy.unblockUser}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={sendRequestOpen} onOpenChange={handleSendRequestOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.sendRequestDialogTitle}</DialogTitle>
            <DialogDescription>{copy.requestsHelp}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="send-request-username">
              {copy.sendRequestUsernameLabel}
            </label>
            <Input
              id="send-request-username"
              value={requestUsername}
              onChange={(event) => setRequestUsername(event.target.value)}
              disabled={sendRequestSubmitting}
            />
            {sendRequestError ? (
              <p className="text-sm text-destructive" role="alert">
                {sendRequestError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleSendRequestOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button
              type="button"
              disabled={sendRequestSubmitting || !requestUsername.trim()}
              onClick={() => void submitSendRequest()}
            >
              {copy.sendRequestSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reportTarget)} onOpenChange={(open) => !open && handleReportOpenChange(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.reportDialogTitle}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="report-reason">
                {copy.reportReasonLabel}
              </label>
              <Input
                id="report-reason"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                disabled={reportSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="report-details">
                {copy.reportDetailsLabel}
              </label>
              <Textarea
                id="report-details"
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                disabled={reportSubmitting}
              />
            </div>
            {reportError ? (
              <p className="text-sm text-destructive" role="alert">
                {reportError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleReportOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button
              ref={reportTriggerRef}
              type="button"
              disabled={reportSubmitting || !reportReason.trim()}
              onClick={() => void submitReport()}
            >
              {copy.reportSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmTarget)} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmSubmitting}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmSubmitting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDestructiveAction();
              }}
            >
              {copy.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
