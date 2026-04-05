"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteStudySet,
  ensureStudySetDb,
  getApprovedBank,
  getDraftQuestions,
  listStudySetMetas,
  putStudySetMeta,
} from "@/lib/db/studySetDb";
import type { StudySetMeta } from "@/types/studySet";

const NEW_SET_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DECK_ACCENTS = [
  {
    gradient: "from-violet-600 via-violet-700 to-indigo-900",
    solid: "bg-violet-600/95 border-violet-400/25",
  },
  {
    gradient: "from-orange-500 via-amber-600 to-orange-900",
    solid: "bg-orange-600/95 border-orange-400/25",
  },
  {
    gradient: "from-sky-500 via-blue-600 to-indigo-900",
    solid: "bg-blue-600/95 border-blue-400/25",
  },
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function accentFor(id: string, index: number) {
  return DECK_ACCENTS[(hashId(id) + index) % DECK_ACCENTS.length]!;
}

export function DashboardLibraryClient() {
  const [sets, setSets] = useState<StudySetMeta[]>([]);
  const [counts, setCounts] = useState<
    Record<string, { draft: number; approved: number }>
  >({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  useEffect(() => {
    if (openMenuId === null && !detailMenuOpen) {
      return;
    }
    const onPointerDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest("[data-dashboard-set-menu]")) {
        setOpenMenuId(null);
      }
      if (!el?.closest("[data-dashboard-detail-menu]")) {
        setDetailMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [openMenuId, detailMenuOpen]);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      await ensureStudySetDb();
      const list = await listStudySetMetas();
      setSets(list);
      const next: Record<string, { draft: number; approved: number }> = {};
      await Promise.all(
        list.map(async (s) => {
          const [draft, bank] = await Promise.all([
            getDraftQuestions(s.id),
            getApprovedBank(s.id),
          ]);
          next[s.id] = {
            draft: draft.length,
            approved: bank?.questions.length ?? 0,
          };
        }),
      );
      setCounts(next);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load study sets.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (sets.length === 0) {
      setSelectedSetId(null);
      return;
    }
    setSelectedSetId((cur) => {
      if (cur && sets.some((s) => s.id === cur)) {
        return cur;
      }
      return sets[0]!.id;
    });
  }, [sets]);

  const filteredSets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return sets;
    }
    return sets.filter((s) => {
      const t = s.title.toLowerCase();
      const f = (s.sourceFileName ?? "").toLowerCase();
      return t.includes(q) || f.includes(q);
    });
  }, [sets, search]);

  const selected = useMemo(
    () => sets.find((s) => s.id === selectedSetId) ?? null,
    [sets, selectedSetId],
  );
  const selectedCounts = selected
    ? (counts[selected.id] ?? { draft: 0, approved: 0 })
    : { draft: 0, approved: 0 };

  const handleRename = useCallback(
    async (id: string, current: string) => {
      setOpenMenuId(null);
      setDetailMenuOpen(false);
      const next = window.prompt("Study set title", current);
      if (next === null || next.trim() === "" || next.trim() === current) {
        return;
      }
      const meta = sets.find((s) => s.id === id);
      if (!meta) {
        return;
      }
      await putStudySetMeta({
        ...meta,
        title: next.trim(),
        updatedAt: new Date().toISOString(),
      });
      await refresh();
    },
    [sets, refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setOpenMenuId(null);
      setDetailMenuOpen(false);
      if (!window.confirm("Delete this study set and all its data?")) {
        return;
      }
      await deleteStudySet(id);
      await refresh();
    },
    [refresh],
  );

  const coverAccent = selected ? accentFor(selected.id, 0) : DECK_ACCENTS[0]!;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1
            className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--d2q-text)] sm:text-3xl"
          >
            Library
          </h1>
          <p className="mt-1 text-sm text-[var(--d2q-muted)]">
            Each set is one PDF import with its own source text, draft
            questions, and saved bank.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-1 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search study sets</span>
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--d2q-muted)]"
              aria-hidden
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-xl border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] py-2.5 pl-10 pr-3 text-sm text-[var(--d2q-text)] placeholder:text-[var(--d2q-muted)] outline-none ring-violet-500/40 focus:border-[var(--d2q-accent)]/50 focus:ring-2"
            />
          </label>
          <Link
            href="/sets/new"
            className="shrink-0 rounded-xl bg-[var(--d2q-accent)] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition-colors hover:bg-[var(--d2q-accent-hover)]"
          >
            + New study set
          </Link>
        </div>
      </header>

      {loadError ? (
        <p className="text-sm font-medium text-red-400" role="alert">
          {loadError}
        </p>
      ) : null}

      {sets.length === 0 && !loadError ? (
        <div className="rounded-2xl border border-dashed border-[var(--d2q-border-strong)] bg-[var(--d2q-surface)] p-10 text-center">
          <p className="text-[var(--d2q-text)]">No study sets yet.</p>
          <p className="mt-2 text-sm text-[var(--d2q-muted)]">
            Import a PDF to create your first set.
          </p>
          <Link
            href="/sets/new"
            className="mt-6 inline-block rounded-xl bg-[var(--d2q-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--d2q-accent-hover)]"
          >
            Import PDF
          </Link>
        </div>
      ) : null}

      {sets.length > 0 && !loadError ? (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {selected ? (
            <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-[min(100%,22rem)] xl:w-[30%]">
              <div
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${coverAccent.gradient} p-1 shadow-xl shadow-black/40`}
              >
                <div className="flex aspect-[4/3] flex-col justify-end rounded-[0.9rem] bg-black/20 p-4 backdrop-blur-[2px]">
                  <p className="text-xs font-medium uppercase tracking-widest text-white/80">
                    Study set
                  </p>
                  <p className="mt-1 line-clamp-2 font-[family-name:var(--font-display)] text-xl font-bold text-white">
                    {selected.title}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--d2q-accent)] px-4 py-2 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
                >
                  <IconCopy className="h-4 w-4" />
                  Duplicate
                </button>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] text-[var(--d2q-muted)] cursor-not-allowed"
                >
                  <IconShare className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] text-[var(--d2q-muted)] cursor-not-allowed"
                >
                  <IconHeart className="h-4 w-4" />
                </button>
                <div className="relative" data-dashboard-detail-menu>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={detailMenuOpen}
                    onClick={() => setDetailMenuOpen((v) => !v)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] text-[var(--d2q-text)] hover:bg-[var(--d2q-surface)]"
                  >
                    <span className="sr-only">More</span>
                    <span className="text-lg leading-none">⋯</span>
                  </button>
                  {detailMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute left-0 z-50 mt-2 min-w-44 rounded-xl border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] py-1 shadow-xl"
                    >
                      <Link
                        role="menuitem"
                        href={`/sets/${selected.id}/source`}
                        onClick={() => setDetailMenuOpen(false)}
                        className="block px-3 py-2 text-left text-sm text-[var(--d2q-text)] hover:bg-[var(--d2q-surface)]"
                      >
                        Open set
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-[var(--d2q-text)] hover:bg-[var(--d2q-surface)]"
                        onClick={() => void handleRename(selected.id, selected.title)}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-red-400 hover:bg-red-950/30"
                        onClick={() => void handleDelete(selected.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled
                        title="Coming soon"
                        className="block w-full cursor-not-allowed px-3 py-2 text-left text-sm text-[var(--d2q-muted)]"
                      >
                        Share (soon)
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--d2q-text)]">
                  {selected.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--d2q-muted)]">
                  {selectedCounts.approved} approved question
                  {selectedCounts.approved === 1 ? "" : "s"}
                  {selectedCounts.draft > 0
                    ? ` · ${selectedCounts.draft} in draft`
                    : ""}
                  {selected.sourceFileName
                    ? ` · Source: ${selected.sourceFileName}`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-[var(--d2q-muted)]">
                  Updated {new Date(selected.updatedAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/sets/${selected.id}/play`}
                  className="rounded-xl bg-[var(--d2q-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--d2q-accent-hover)]"
                >
                  Take quiz
                </Link>
                <Link
                  href={`/sets/${selected.id}/review`}
                  className="rounded-xl border border-[var(--d2q-border-strong)] bg-[var(--d2q-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--d2q-text)] hover:bg-[var(--d2q-surface-elevated)]"
                >
                  Edit
                </Link>
              </div>
            </aside>
          ) : null}

          <div className="min-w-0 flex-1">
            {filteredSets.length === 0 ? (
              <p className="rounded-2xl border border-[var(--d2q-border)] bg-[var(--d2q-surface)] p-8 text-center text-sm text-[var(--d2q-muted)]">
                No sets match &ldquo;{search.trim()}&rdquo;.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredSets.map((s, index) => {
                  const c = counts[s.id] ?? { draft: 0, approved: 0 };
                  const isSel = s.id === selectedSetId;
                  const updated = new Date(s.updatedAt).getTime();
                  const isNew = Date.now() - updated < NEW_SET_MAX_AGE_MS;
                  const isCompleted =
                    c.approved > 0 && c.draft === 0;
                  const acc = accentFor(s.id, index);
                  const tinted = index % 2 === 1;

                  return (
                    <li key={s.id} className="relative pt-3">
                      <div
                        className="pointer-events-none absolute left-6 right-6 top-0 z-0 h-4 rounded-t-xl bg-[var(--d2q-surface-elevated)] opacity-80 shadow-sm"
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute left-8 right-8 top-1 z-0 h-3 rounded-t-lg bg-[var(--d2q-surface)] opacity-60"
                        aria-hidden
                      />

                      <div
                        className={`relative z-10 overflow-hidden rounded-2xl border text-left shadow-lg transition-all ${
                          tinted
                            ? `${acc.solid} border-white/10 text-white shadow-black/30`
                            : "border-[var(--d2q-border)] bg-[var(--d2q-surface)] text-[var(--d2q-text)] shadow-black/20"
                        } ${
                          isSel
                            ? "ring-2 ring-[var(--d2q-accent)] ring-offset-2 ring-offset-[var(--d2q-bg)]"
                            : "hover:border-[var(--d2q-border-strong)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSetId(s.id)}
                          className="w-full p-4 text-left"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3
                              className={`line-clamp-2 font-[family-name:var(--font-display)] text-base font-bold ${
                                tinted ? "text-white" : "text-[var(--d2q-text)]"
                              }`}
                            >
                              {s.title}
                            </h3>
                            <div className="flex flex-wrap justify-end gap-1">
                              {isCompleted ? (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                    tinted
                                      ? "bg-white/20 text-white"
                                      : "bg-[var(--d2q-accent-muted)] text-[var(--d2q-accent-hover)]"
                                  }`}
                                >
                                  ✓ Completed
                                </span>
                              ) : null}
                              {isNew ? (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                    tinted
                                      ? "bg-black/25 text-amber-200"
                                      : "bg-orange-950/50 text-[var(--d2q-accent-warm)]"
                                  }`}
                                >
                                  New
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p
                            className={`mt-2 break-all text-xs ${
                              tinted ? "text-white/75" : "text-[var(--d2q-muted)]"
                            }`}
                          >
                            {c.approved} approved · {c.draft} draft
                          </p>
                          <p
                            className={`mt-1 line-clamp-2 text-xs ${
                              tinted ? "text-white/60" : "text-[var(--d2q-muted)]"
                            }`}
                          >
                            {new Date(s.updatedAt).toLocaleString()}
                            {s.sourceFileName ? ` · ${s.sourceFileName}` : ""}
                          </p>
                        </button>

                        <div
                          className={`flex flex-wrap gap-2 border-t px-4 py-3 ${
                            tinted
                              ? "border-white/15 bg-black/15"
                              : "border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)]/40"
                          }`}
                        >
                          <Link
                            href={`/sets/${s.id}/play`}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                              tinted
                                ? "bg-white text-violet-900 hover:bg-white/90"
                                : "bg-[var(--d2q-text)] text-[var(--d2q-bg)] hover:bg-white"
                            }`}
                          >
                            Take quiz
                          </Link>
                          <Link
                            href={`/sets/${s.id}/review`}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                              tinted
                                ? "border-white/30 text-white hover:bg-white/10"
                                : "border-[var(--d2q-border-strong)] text-[var(--d2q-text)] hover:bg-[var(--d2q-surface-elevated)]"
                            }`}
                          >
                            Edit
                          </Link>
                          <div className="relative" data-dashboard-set-menu>
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={openMenuId === s.id}
                              onClick={() =>
                                setOpenMenuId((cur) =>
                                  cur === s.id ? null : s.id,
                                )
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                                tinted
                                  ? "border-white/30 text-white hover:bg-white/10"
                                  : "border-[var(--d2q-border-strong)] text-[var(--d2q-text)] hover:bg-[var(--d2q-surface-elevated)]"
                              }`}
                            >
                              More
                            </button>
                            {openMenuId === s.id ? (
                              <div
                                role="menu"
                                className="absolute left-0 z-[60] mt-1 min-w-40 rounded-xl border border-[var(--d2q-border)] bg-[var(--d2q-surface-elevated)] py-1 shadow-xl"
                              >
                                <Link
                                  role="menuitem"
                                  href={`/sets/${s.id}/source`}
                                  onClick={() => setOpenMenuId(null)}
                                  className="block px-3 py-2 text-left text-xs font-medium text-[var(--d2q-text)] hover:bg-[var(--d2q-surface)]"
                                >
                                  Open set
                                </Link>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full cursor-pointer px-3 py-2 text-left text-xs font-medium text-[var(--d2q-text)] hover:bg-[var(--d2q-surface)]"
                                  onClick={() =>
                                    void handleRename(s.id, s.title)
                                  }
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full cursor-pointer px-3 py-2 text-left text-xs font-medium text-red-400 hover:bg-red-950/30"
                                  onClick={() => void handleDelete(s.id)}
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled
                                  title="Coming soon"
                                  className="block w-full cursor-not-allowed px-3 py-2 text-left text-xs text-[var(--d2q-muted)]"
                                >
                                  Share (soon)
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}

                <li className="relative pt-3">
                  <div
                    className="pointer-events-none absolute left-6 right-6 top-0 z-0 h-4 rounded-t-xl border border-dashed border-[var(--d2q-border-strong)] bg-transparent opacity-50"
                    aria-hidden
                  />
                  <Link
                    href="/sets/new"
                    className="relative z-10 flex min-h-[11rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--d2q-border-strong)] bg-[var(--d2q-surface)]/50 p-6 text-[var(--d2q-muted)] transition-colors hover:border-[var(--d2q-accent)]/50 hover:text-[var(--d2q-text)]"
                  >
                    <span className="text-3xl font-light leading-none">+</span>
                    <span className="text-sm font-semibold">Add new set</span>
                  </Link>
                </li>
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconShare({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
