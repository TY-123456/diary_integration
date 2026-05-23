# Conversation Integration Index

This project now treats these older VS Code Codex conversation topics as part of the `diary_integration` project context.

## Integrated Conversations

### 開發記事匯入手機APP

Integrated into:

- `required.md` for the original product request and user-facing requirements.
- `AGENTS.md` for clarified implementation guidance and product rules.

Key preserved context:

- Build a dark-mode-only responsive note web app that works on mobile.
- Support Evernote and Google Keep import while preserving creation time, modified time, tags, folders/notebooks when available, attachments, and metadata.
- Use a folder-based note model where each note belongs to exactly one folder.
- Provide rich note editing with title, body, font size, font color, image insertion, undo/redo, save, and delete.
- Keep mobile behavior first-class, including export, browser Back behavior, and compact toolbar/list controls.

### Review required.md gaps

Integrated into:

- `docs/review-required-gaps.md` for review findings, open questions, decisions, and future requirement workflow.
- `AGENTS.md` for the resulting implementation guidance.

Key preserved context:

- Do not use old chat history as the source of truth.
- Keep `required.md` as the original requirement summary.
- Use `AGENTS.md` for clarified product and implementation rules.
- Use `docs/review-required-gaps.md` for gaps, risks, open questions, and requirement-change decisions.
- Verify provider API feasibility before promising one-click Evernote or Google Keep import.
- Prefer practical fallback import paths such as Evernote `.enex` and Google Takeout if official APIs are insufficient.

## Current Source Of Truth

- `required.md`: original and current user-facing requirement summary.
- `AGENTS.md`: durable product specification and implementation guidance for future Codex work.
- `docs/review-required-gaps.md`: gap review, decisions, open questions, and requirement-change workflow.
- `docs/conversation-integration.md`: index showing which older conversation topics were merged into this project.

## Future Workflow

When another VS Code Codex conversation should be merged into this project:

1. Extract only durable decisions, requirements, risks, and unresolved tasks.
2. Update `required.md` only if the user-facing requirement itself changed.
3. Update `AGENTS.md` when future agents need implementation guidance.
4. Update `docs/review-required-gaps.md` when the conversation adds gaps, risks, decisions, or open questions.
5. Update this file to record the conversation topic and where its durable content now lives.
