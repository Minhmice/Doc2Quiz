"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { CanonicalSourceReview } from "@/components/canonical/CanonicalSourceReview";
import { StudySetCreateWizard } from "@/components/create/StudySetCreateWizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  postWorkspaceFlashcardGenerate,
  saveFlashcardSourceSelection,
} from "@/lib/client/flashcardGenerateStudySet";
import {
  postWorkspaceQuizGenerate,
  saveQuizSourceSelection,
} from "@/lib/client/quizGenerateStudySet";
import { fetchWorkspaceDetail, patchDocument, softDeleteDocument } from "@/lib/client/workspaceApi";
import { postWorkspaceCanonicalize } from "@/lib/client/canonicalReader";
import {
  copyShareLinkToClipboard,
  createWorkspaceInvitation,
  createWorkspaceShare,
  listWorkspaceMembers,
  type WorkspaceMember,
  type WorkspaceMemberRole,
} from "@/lib/client/workspaceCollaboration";
import {
  flashcardOverview,
  flashcardPlay,
  quizOverview,
  quizPlay,
} from "@/lib/routes/studySetPaths";
import type {
  WorkspaceDetail,
  WorkspaceDetailCanonicalVersion,
} from "@/lib/workspaces/workspaceSummary";

export type WorkspaceDetailClientProps = Readonly<{
  workspaceId: string;
}>;

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getFileFormatLabel(filename: string | null, sourceKind: string): string {
  if (filename) {
    const ext = filename.split(".").pop()?.toUpperCase();
    if (ext && ext.length <= 4) return ext;
  }
  return sourceKind.toUpperCase();
}

export function WorkspaceDetailClient({
  workspaceId,
}: WorkspaceDetailClientProps) {
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [readingVersionId, setReadingVersionId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"quiz" | "flashcards" | null>(null);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [expandedDocumentIds, setExpandedDocumentIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryingVersionId, setRetryingVersionId] = useState<string | null>(null);

  // Sharing & settings dialog state
  const [sharingOpen, setSharingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [recipient, setRecipient] = useState("");
  const [role, setRole] = useState<WorkspaceMemberRole>("editor");
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  // Output friend sharing
  const [friendShares, setFriendShares] = useState<Record<string, boolean>>({});
  const [sharingOutputId, setSharingOutputId] = useState<string | null>(null);
  const [outputShareError, setOutputShareError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const next = await fetchWorkspaceDetail(workspaceId);
      setDetail(next);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshMembers = useCallback(async () => {
    if (detail?.role !== "owner") return;
    try {
      const nextMembers = await listWorkspaceMembers(workspaceId);
      setMembers(nextMembers);
    } catch {
      setShareStatus("Could not load collaborators.");
    }
  }, [detail?.role, workspaceId]);

  useEffect(() => {
    if (sharingOpen) void refreshMembers();
  }, [sharingOpen, refreshMembers]);

  const setFriendShare = async (outputId: string, shared: boolean) => {
    setOutputShareError(null);
    setSharingOutputId(outputId);
    try {
      const response = await fetch(`/api/friends/quizzes/${outputId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared }),
      });
      if (!response.ok) throw new Error("Could not update friend sharing.");
      setFriendShares((current) => ({ ...current, [outputId]: shared }));
    } catch (error) {
      setOutputShareError(error instanceof Error ? error.message : "Could not update friend sharing.");
    } finally {
      setSharingOutputId(null);
    }
  };

  const selectedVersionIdSet = useMemo(
    () => new Set(selectedVersionIds),
    [selectedVersionIds],
  );

  const completedVersions = useMemo(() => {
    if (!detail) return [] as Array<{
      documentId: string;
      documentTitle: string;
      version: WorkspaceDetailCanonicalVersion;
    }>;
    const rows: Array<{
      documentId: string;
      documentTitle: string;
      version: WorkspaceDetailCanonicalVersion;
    }> = [];
    for (const document of detail.documents) {
      for (const documentVersion of document.versions) {
        for (const canonical of documentVersion.canonicalVersions) {
          if (canonical.status === "completed") {
            rows.push({ documentId: document.id, documentTitle: document.title, version: canonical });
          }
        }
      }
    }
    return rows;
  }, [detail]);

  const runSourceAction = async (
    action: "retry" | "delete" | "rename",
    documentId: string,
    documentVersionId?: string,
    currentTitle?: string,
  ) => {
    setActionError(null);
    if (action === "retry" && documentVersionId) {
      setRetryingVersionId(documentVersionId);
    }
    try {
      if (action === "retry" && documentVersionId) {
        await postWorkspaceCanonicalize({ workspaceId, documentId, documentVersionId });
      } else if (action === "delete") {
        if (window.confirm("Delete this source document? Existing generated outputs will remain available.")) {
          await softDeleteDocument(workspaceId, documentId);
        } else {
          return;
        }
      } else if (action === "rename") {
        const title = window.prompt("Rename source", currentTitle ?? "");
        if (!title?.trim()) return;
        await patchDocument(workspaceId, documentId, { title: title.trim() });
      }
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Source action failed.");
    } finally {
      setRetryingVersionId(null);
    }
  };

  const toggleVersion = (canonicalVersionId: string) => {
    setSelectedVersionIds((prev) =>
      prev.includes(canonicalVersionId)
        ? prev.filter((id) => id !== canonicalVersionId)
        : [...prev, canonicalVersionId],
    );
  };

  const toggleDocument = (documentId: string) => {
    setExpandedDocumentIds((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId],
    );
  };

  const runGenerate = async (kind: "quiz" | "flashcards") => {
    if (selectedVersionIds.length === 0) {
      setGenerateError("Select at least one ready source version.");
      return;
    }
    setGenerateError(null);
    setGenerating(kind);
    try {
      if (kind === "quiz") {
        saveQuizSourceSelection(workspaceId, selectedVersionIds);
        const result = await postWorkspaceQuizGenerate(workspaceId, {
          canonicalVersionIds: selectedVersionIds,
        });
        const setId = result.bridgeStudySetId ?? result.studySetId;
        if (setId) {
          window.location.assign(quizOverview(setId));
          return;
        }
      } else {
        saveFlashcardSourceSelection(workspaceId, selectedVersionIds);
        const result = await postWorkspaceFlashcardGenerate(workspaceId, {
          canonicalVersionIds: selectedVersionIds,
          learningGoal: "memorize",
          coverage: "entire_document",
          amount: "recommended",
        });
        const setId = result.bridgeStudySetId ?? result.studySetId;
        if (setId) {
          window.location.assign(flashcardOverview(setId));
          return;
        }
      }
      await refresh();
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Generation failed.",
      );
    } finally {
      setGenerating(null);
    }
  };

  const inviteCollaborator = async () => {
    if (!recipient.trim()) return;
    setShareSubmitting(true);
    setShareStatus(null);
    try {
      await createWorkspaceInvitation(workspaceId, { recipientUserId: recipient.trim(), role });
      setRecipient("");
      setShareStatus("Invitation sent.");
      await refreshMembers();
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "Could not send invitation.");
    } finally {
      setShareSubmitting(false);
    }
  };

  const copyShareLink = async () => {
    setShareSubmitting(true);
    setShareStatus(null);
    try {
      const url = shareUrl ?? (await createWorkspaceShare(workspaceId, { targetKind: "workspace", targetId: workspaceId })).shareUrl;
      setShareUrl(url);
      await copyShareLinkToClipboard(url);
      setShareStatus("Link copied.");
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : "Could not create link.");
    } finally {
      setShareSubmitting(false);
    }
  };

  if (loading && !detail) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-8 text-center" role="status">
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading workspace detail…
        </p>
      </div>
    );
  }

  if (loadError && !detail) {
    return (
      <div className="w-full max-w-xl mx-auto my-12 p-6 rounded-xl border border-destructive/30 bg-destructive/5 space-y-4">
        <p className="text-sm font-semibold text-destructive" role="alert">
          {loadError}
        </p>
        <Button type="button" variant="outline" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  return (
    <div className="w-full space-y-6 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
      {/* Workspace Header Panel (~35% reduced height) */}
      <header className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="size-4" />
                <span className="sr-only">Back to Dashboard</span>
              </Link>
              <h1 className="font-heading text-xl font-bold sm:text-2xl text-foreground truncate">
                {detail.title}
              </h1>
              <Badge variant="outline" className="text-[11px] font-semibold capitalize shrink-0">
                {detail.role}
              </Badge>
            </div>
            {detail.subtitle ? (
              <p className="text-xs text-muted-foreground truncate">{detail.subtitle}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5 font-medium"
              onClick={() => setAddSourceOpen(true)}
            >
              <Plus className="size-4" />
              Add source
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 font-medium"
              onClick={() => setSharingOpen(true)}
            >
              <Share2 className="size-4" />
              Share
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
        </div>

        {/* Metrics Summary Line: 1 source · 0 ready · 0 outputs */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2.5 border-t border-border/40 text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" />
            <strong className="text-foreground">{detail.documents.length}</strong> {detail.documents.length === 1 ? "source" : "sources"}
          </span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-forest-sage" />
            <strong className="text-foreground">{completedVersions.length}</strong> {completedVersions.length === 1 ? "ready" : "ready"}
          </span>
          <span className="text-border">•</span>
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-oxblood-primary" />
            <strong className="text-foreground">{detail.outputs.length}</strong> {detail.outputs.length === 1 ? "output" : "outputs"}
          </span>
          <span className="flex items-center gap-1.5 sm:ml-auto tabular-nums text-muted-foreground/80">
            <Clock className="size-3.5" />
            Updated {formatDate(detail.updatedAt)}
          </span>
        </div>
      </header>

      {actionError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {/* Reader Section */}
      {readingVersionId ? (
        <section className="space-y-3" aria-labelledby="reader-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="reader-heading" className="font-heading text-lg font-bold flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              Canonical Reader
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReadingVersionId(null)}
            >
              <X className="mr-1.5 size-4" />
              Close
            </Button>
          </div>
          <CanonicalSourceReview
            progressive={{ workspaceId, versionId: readingVersionId }}
          />
        </section>
      ) : null}

      {/* Two-Column Desktop Layout (Left: Sources, Right: Create Output + Outputs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Sources */}
        <section className="lg:col-span-7 space-y-4" aria-labelledby="sources-heading">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 id="sources-heading" className="font-heading text-lg font-bold text-foreground">
                Sources
              </h2>
              <p className="text-xs text-muted-foreground">
                {detail.documents.length} document{detail.documents.length === 1 ? "" : "s"} uploaded
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddSourceOpen(true)}>
              <Plus className="size-4 mr-1" /> Add source
            </Button>
          </div>

          {detail.documents.length === 0 ? (
            <Card className="p-8 text-center border-dashed space-y-3">
              <div className="size-10 rounded-full bg-muted/60 mx-auto grid place-items-center text-muted-foreground">
                <FileText className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-heading font-semibold text-sm text-foreground">No sources in this workspace yet</p>
                <CardDescription className="text-xs">
                  Upload a PDF or paste document content to begin synthesizing study materials.
                </CardDescription>
              </div>
              <Button type="button" size="sm" onClick={() => setAddSourceOpen(true)}>
                <Plus className="size-4 mr-1.5" /> Upload first source
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {detail.documents.map((document) => {
                const latestVersion = document.versions[0];
                const canonicalVersions = latestVersion?.canonicalVersions ?? [];
                const readyVersions = canonicalVersions.filter((c) => c.status === "completed");
                const isFailed = canonicalVersions.length > 0 && canonicalVersions.every((c) => c.status === "failed");
                const isProcessing = canonicalVersions.some((c) => c.status === "processing" || c.status === "pending");
                const formatLabel = getFileFormatLabel(latestVersion?.originalFilename, latestVersion?.sourceKind ?? "PDF");
                const expanded = expandedDocumentIds.includes(document.id);

                return (
                  <div
                    key={document.id}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-2xs space-y-3"
                  >
                    {/* Source Card Main Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="font-label text-[10px] uppercase font-bold tracking-wider">
                            {formatLabel}
                          </Badge>
                          {latestVersion ? (
                            <span className="text-xs font-semibold text-foreground">
                              Version {latestVersion.versionNumber}
                            </span>
                          ) : null}

                          {/* Status Chips: Ready / Processing / Failed */}
                          {readyVersions.length > 0 ? (
                            <Badge variant="default" className="bg-forest-sage text-white text-[10px] font-bold">
                              Ready
                            </Badge>
                          ) : isProcessing ? (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px] animate-pulse">
                              Processing…
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] font-bold">
                              {isFailed ? "Processing failed" : "Needs processing"}
                            </Badge>
                          )}
                        </div>

                        <h3 className="font-heading text-base font-bold text-foreground truncate">
                          {document.title}
                        </h3>

                        <p className="text-xs text-muted-foreground tabular-nums">
                          Updated {formatDate(document.updatedAt)}
                        </p>
                      </div>

                      {/* Source Actions (Direct recovery / retry if failed/missing) */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {readyVersions.length === 0 && latestVersion ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="min-h-9 gap-1.5 text-xs font-medium bg-oxblood-primary text-white"
                            disabled={retryingVersionId === latestVersion.id}
                            onClick={() => void runSourceAction("retry", document.id, latestVersion.id)}
                          >
                            <RefreshCw className={`size-3.5 ${retryingVersionId === latestVersion.id ? "animate-spin" : ""}`} />
                            {retryingVersionId === latestVersion.id ? "Processing…" : "Retry processing"}
                          </Button>
                        ) : null}

                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" className="size-9" aria-label={`Source options for ${document.title}`} />}>
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void runSourceAction("rename", document.id, undefined, document.title)}>
                              <Pencil className="size-4" /> Rename
                            </DropdownMenuItem>
                            {latestVersion ? (
                              <DropdownMenuItem onClick={() => void runSourceAction("retry", document.id, latestVersion.id)}>
                                <RefreshCw className="size-4" /> Process / Retry
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem variant="destructive" onClick={() => void runSourceAction("delete", document.id)}>
                              <Trash2 className="size-4" /> Delete source
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Versions detail section */}
                    <div className="border-t border-border/40 pt-2">
                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => toggleDocument(document.id)}
                        >
                          {expanded ? "Hide versions" : `View versions (${document.versions.length})`}
                          <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </Button>
                      </div>

                      {expanded ? (
                        <div className="mt-3 space-y-2 pl-2 border-l-2 border-border/40">
                          {document.versions.map((ver) => (
                            <div key={ver.id} className="space-y-1.5 text-xs">
                              <div className="flex items-center justify-between text-muted-foreground font-medium">
                                <span>
                                  Version {ver.versionNumber} ({ver.originalFilename ?? ver.sourceKind})
                                </span>
                                <span className="tabular-nums">{formatDate(ver.createdAt)}</span>
                              </div>

                              {ver.canonicalVersions.map((canonical) => {
                                const isReady = canonical.status === "completed";
                                const isSelected = selectedVersionIdSet.has(canonical.id);

                                return (
                                  <div
                                    key={canonical.id}
                                    className={`rounded-lg border p-2.5 flex items-center justify-between gap-3 transition-all ${
                                      isSelected
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                        : "border-border/50 bg-background/50 hover:border-border"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {isReady ? (
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => toggleVersion(canonical.id)}
                                          aria-label={`Select ready source version ${canonical.versionNumber}`}
                                        />
                                      ) : null}

                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-foreground">
                                            v{canonical.versionNumber}
                                          </span>
                                          <Badge
                                            variant={isReady ? "default" : "secondary"}
                                            className="font-label text-[9px] uppercase"
                                          >
                                            {canonical.status}
                                          </Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                          {canonical.provenanceLabel}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs font-medium gap-1 px-2"
                                        onClick={() => setReadingVersionId(canonical.id)}
                                      >
                                        <Eye className="size-3" /> Read
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Create Output & Outputs */}
        <div className="lg:col-span-5 space-y-6">
          {/* Create Output Panel */}
          <section className="rounded-xl border border-border/60 bg-card p-5 shadow-2xs space-y-4" aria-labelledby="create-output-heading">
            <div className="space-y-1">
              <h2 id="create-output-heading" className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-oxblood-primary" />
                Create output
              </h2>
              <p className="text-xs text-muted-foreground">
                Select ready sources from the left to generate study materials.
              </p>
            </div>

            {/* Selection summary & actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-foreground">
                  {selectedVersionIds.length > 0
                    ? `${selectedVersionIds.length} ready ${selectedVersionIds.length === 1 ? "source" : "sources"} selected`
                    : "No ready sources selected"}
                </span>
                {selectedVersionIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground p-0"
                    onClick={() => setSelectedVersionIds([])}
                  >
                    Clear selection
                  </Button>
                ) : null}
              </div>

              {completedVersions.length === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    No ready sources available
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Process or retry a source on the left to enable output generation.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="gap-2 font-medium bg-oxblood-primary text-white"
                  disabled={generating !== null || selectedVersionIds.length === 0}
                  onClick={() => void runGenerate("quiz")}
                >
                  <Sparkles className="size-4" />
                  {generating === "quiz" ? "Generating…" : "Quiz"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 font-medium"
                  disabled={generating !== null || selectedVersionIds.length === 0}
                  onClick={() => void runGenerate("flashcards")}
                >
                  <Layers className="size-4" />
                  {generating === "flashcards" ? "Generating…" : "Flashcards"}
                </Button>
              </div>

              {generating ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                  <span className="size-2 rounded-full bg-primary animate-pulse" />
                  <span>Synthesizing study set from selected sources…</span>
                </div>
              ) : null}

              {generateError ? (
                <p className="text-xs font-semibold text-destructive" role="alert">
                  {generateError}
                </p>
              ) : null}
            </div>
          </section>

          {/* Outputs Section */}
          <section className="space-y-3" aria-labelledby="outputs-heading">
            <div>
              <h2 id="outputs-heading" className="font-heading text-lg font-bold text-foreground">
                Outputs
              </h2>
              {outputShareError ? (
                <p className="mt-1 text-xs text-destructive" role="alert">{outputShareError}</p>
              ) : null}
            </div>

            {detail.outputs.length === 0 ? (
              <Card className="p-6 text-center border-dashed space-y-2">
                <p className="font-semibold text-sm text-foreground">No outputs yet</p>
                <CardDescription className="text-xs">
                  Process a source, then generate your first quiz or flashcard set.
                </CardDescription>
              </Card>
            ) : (
              <div className="space-y-3">
                {detail.outputs.map((output) => {
                  const overviewHref =
                    output.kind === "flashcards"
                      ? flashcardOverview(output.bridgeStudySetId)
                      : quizOverview(output.bridgeStudySetId);
                  const practiceHref =
                    output.kind === "flashcards"
                      ? flashcardPlay(output.bridgeStudySetId)
                      : quizPlay(output.bridgeStudySetId);
                  const isFlashcards = output.kind === "flashcards";

                  return (
                    <div
                      key={output.id}
                      className="rounded-xl border border-border/60 bg-card p-4 flex flex-col justify-between gap-3 shadow-2xs transition-all hover:border-primary/40"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant={isFlashcards ? "secondary" : "default"}
                            className="font-label text-[10px] tracking-wider uppercase"
                          >
                            {isFlashcards ? "Flashcards" : "Quiz"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground capitalize font-medium">
                            {output.status}
                          </span>
                        </div>
                        <p className="font-heading font-bold text-sm text-foreground truncate">
                          {output.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Updated {formatDate(output.updatedAt)}
                        </p>
                      </div>

                      {!isFlashcards && detail.role === "owner" ? (
                        <label className="flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs font-medium">
                          <span>Chia sẻ với bạn bè</span>
                          <Switch
                            checked={friendShares[output.id] ?? false}
                            disabled={sharingOutputId === output.id}
                            onCheckedChange={(shared) => void setFriendShare(output.id, shared)}
                            aria-label={`Chia sẻ ${output.title} với bạn bè`}
                          />
                        </label>
                      ) : null}

                      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                        <Link href={overviewHref} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full text-xs font-medium h-8">
                            Overview
                          </Button>
                        </Link>
                        <Link href={practiceHref} className="flex-1">
                          <Button variant="default" size="sm" className="w-full text-xs font-medium h-8 bg-oxblood-primary text-white">
                            Practice
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Add Source Document Dialog */}
      <Dialog open={addSourceOpen} onOpenChange={setAddSourceOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add source document</DialogTitle>
            <DialogDescription>Upload a PDF, text, or paste content into this workspace.</DialogDescription>
          </DialogHeader>
          <StudySetCreateWizard contentKind="quiz" workspaceId={workspaceId} />
        </DialogContent>
      </Dialog>

      {/* Share Workspace Dialog */}
      <Dialog open={sharingOpen} onOpenChange={setSharingOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share “{detail.title}”</DialogTitle>
            <DialogDescription>Invite collaborators or copy a workspace share link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {detail.role === "owner" ? (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-foreground" htmlFor="workspace-recipient">Add collaborators</label>
                <div className="flex gap-2">
                  <Input
                    id="workspace-recipient"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void inviteCollaborator(); }}
                    placeholder="User ID or email address"
                    className="h-10 text-sm"
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as WorkspaceMemberRole)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button type="button" className="h-10" disabled={!recipient.trim() || shareSubmitting} onClick={() => void inviteCollaborator()}>
                    Send
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-foreground">People with access</h3>
              <div className="divide-y divide-border/60 rounded-lg border border-border/60 p-3">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-medium text-foreground truncate">{m.userId}</span>
                    <span className="text-muted-foreground capitalize">{m.role}</span>
                  </div>
                ))}
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Only you have access.</p>
                ) : null}
              </div>
            </div>

            {shareStatus ? <p role="status" className="text-xs text-muted-foreground">{shareStatus}</p> : null}

            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              <Button type="button" variant="outline" size="sm" disabled={shareSubmitting} onClick={() => void copyShareLink()}>
                {shareStatus === "Link copied." ? <Check className="size-4 mr-1.5 text-forest-sage" /> : <Share2 className="size-4 mr-1.5" />}
                {shareStatus === "Link copied." ? "Link copied" : "Copy share link"}
              </Button>
              <Button type="button" size="sm" onClick={() => setSharingOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workspace Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Workspace settings</DialogTitle>
            <DialogDescription>Manage workspace title, default rules, and danger zone.</DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border/60 rounded-lg border border-border/60">
            <div className="p-4 space-y-1">
              <p className="font-medium text-sm text-foreground">Workspace details</p>
              <p className="text-xs text-muted-foreground">Rename workspace, edit description, and manage team access.</p>
            </div>
            <div className="p-4 space-y-1">
              <p className="font-medium text-sm text-foreground">Source processing defaults</p>
              <p className="text-xs text-muted-foreground">Choose default model, prompt version, and section extraction limits.</p>
            </div>
            <div className="p-4 space-y-1">
              <p className="font-medium text-sm text-destructive">Danger zone</p>
              <p className="text-xs text-muted-foreground">Archive workspace or clear all source documents.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
