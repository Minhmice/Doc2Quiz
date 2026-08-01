---
title: Workspace source actions and output dialog
priority: high
date: 2026-07-30
---

## Goal

Make workspace sources recoverable and output generation easy without crowding the workspace page.

## Required behavior

- Source card remains visible when no canonical version exists.
- Source card has a three-dot context menu with Delete, Rename, and Retry canonicalization.
- Retry canonicalization also appears on version rows when canonical processing fails.
- Workbench header has one `Add output` button.
- `Add output` opens a dialog with output type and generation settings.
- Dialog reuses `StudySetCreateWizard`.
- Wizard allows uploading or pasting a new source.
- Existing source remains untouched until new source ingest succeeds.
- New output attaches to current workspace after successful ingest.

## Done when

A user can recover failed canonical processing, manage source cards, open one clear output action, configure generation, and upload or paste a replacement source without losing the current workspace source.
