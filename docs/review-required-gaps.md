# Review: required.md Gaps

## Purpose

This document summarizes the gaps found when reviewing `required.md` and records product decisions that should guide future work.

Keep `required.md` as the original request. Use this file for review notes, clarified decisions, and open questions.

See `docs/conversation-integration.md` for the index of older VS Code Codex conversation topics that have been merged into this project.

## Key Gaps Found

- Storage strategy was not specified.
- Evernote import feasibility needs verification because API access, permissions, and rate limits may change.
- Google Keep may not provide a complete official API for the required import behavior, so Google Takeout support is the safer fallback.
- Imported images and attachments need a durable storage strategy instead of being stored only as inline editor content.
- Duplicate import handling is required so the same Evernote or Google Keep note is not imported repeatedly.
- Import conflict handling is needed when a previously imported note was edited locally and later imported again.
- Export and backup are important because the app stores personal notes.
- Mobile installation should be handled through PWA support if this remains a web app.
- Timestamp rules need to be explicit so original creation time is never overwritten.

## Decisions Made

- The first version is a responsive web app that works on desktop and mobile browsers.
- The UI is dark mode only.
- The app uses folder-based organization where each note belongs to exactly one folder.
- Trash is now a required first step for note deletion, with recovery before permanent deletion.
- Tags may still be preserved from imported sources.
- Native notes automatically record `createdAt`.
- Imported notes preserve original `createdAt` from the source when available.
- `createdAt` must remain immutable after note creation or import.
- `updatedAt` changes only when note content, title, folder, tags, or attachments change.
- Evernote import should support `.enex` files as a practical local import path.
- Google Keep import should support Google Takeout files as a practical local import path.
- The normalized data model should support notes, folders, attachments, source metadata, and import timestamps.
- Mobile export must use a mobile-friendly flow where available, such as the Web Share API with a download fallback.
- Mobile browser Back should first return to the menu.
- Toolbar hiding should only hide formatting and insert tools; Undo, Redo, Save, and Delete remain visible.

## 2026-05-23 Requirement Update

- Add a Trash button under the Folders list.
- Change note deletion to move notes to Trash first.
- Add note recovery from Trash.
- Fix mobile sync export.
- Fix the Move note close button.
- Change the mobile new-note button from `+` to `+ NOTE`.
- Add Word-like hide/unhide controls for the note list and toolbar.
- Keep Undo, Redo, Save, and Delete visible when toolbar tools are hidden.
- Prevent Undo and Redo from opening the mobile keyboard.
- Use curved arrow icons for Undo and Redo.
- Make mobile browser Back return to the menu first.

## Open Questions

- Should the production version stay local-first, or should it add cloud sync?
- If cloud sync is added, which backend and authentication model should be used?
- Should attachments be stored in IndexedDB, local files, cloud object storage, or another storage layer?
- How much rich text fidelity is required when importing Evernote and Google Keep notes?
- Should imported notes be editable directly, or should the app keep an untouched original copy?
- Should the app support encrypted local storage or a password lock?

## Recommended Requirement Workflow

When changing requirements, do not rely on old chat history as the source of truth.

Use this order:

1. Update `required.md` only when the original user-facing requirement changes.
2. Update `AGENTS.md` when the clarified product rules or implementation guidance changes.
3. Update this file when a review finds new gaps, risks, or decisions.
4. Commit the changes after the requirement documents are updated.

For future Codex prompts, start from the current project and say which file should change. For example:

```text
Please update the requirements: I want the app to support cloud sync later, but keep MVP local-first.
Update required.md, AGENTS.md, and docs/review-required-gaps.md if needed.
```

## Current Source Of Truth

- `required.md`: original requirement summary.
- `AGENTS.md`: clarified product specification and implementation guidance.
- `docs/review-required-gaps.md`: gaps, risks, open questions, and requirement-change workflow.
