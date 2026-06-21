# Diary Integration App Requirements

## Product Goal

Build a dark-mode-only responsive web app for creating, organizing, editing, and importing personal notes. The app should work well on desktop and mobile browsers.

The app should support:

- New note creation inside the app.
- Folder-based organization, where each note belongs to exactly one folder.
- Rich note editing with title, body, image insertion, font size, and font color controls.
- Automatic preservation of creation time for both imported and newly created notes.
- Importing existing notes from Evernote and Google Keep while preserving as much original metadata as possible.

## Product Decisions

- Platform: responsive web app.
- Mobile support: required from the first version.
- Theme: dark mode only. Do not implement a light theme or theme switcher.
- Organization model: folders, not multi-folder categorization. A note may also have tags if imported from a source that provides tags.
- Data ownership: the user should own their notes and attachments. Avoid designs that make export or backup difficult.
- Imported creation time must remain immutable after import.
- New notes should record `createdAt` automatically and keep it unchanged after edits.
- Edited notes should update `updatedAt`.
- Deleting a note should first move it to Trash so it can be recovered before permanent deletion.
- Mobile export and navigation flows are required, including browser Back returning to the menu first.

## Recommended MVP

Implement the first usable version in this order:

1. Responsive dark app shell with sidebar/folder navigation.
2. Local note CRUD: create, read, update, delete.
3. Folder CRUD: create, rename, delete, move note to folder.
4. Rich text editor with title field, body editor, font size, font color, image insert, undo/redo, and autosave.
5. Attachment storage and display for inserted images.
6. Import framework with normalized note model.
7. Evernote import.
8. Google Keep import.
9. Export/backup.

## UI Requirements

### Layout

Use a three-area layout on desktop:

- Left sidebar: folder list and import actions.
- Middle list: notes in the selected folder.
- Main editor: selected note content.

On mobile:

- Use a navigation drawer or stacked views.
- The editor should be the primary focus after a note is selected.
- Folder and note navigation must be reachable without overcrowding the editor.

### Sidebar

The left sidebar should feel similar to Codex's chat sidebar:

- Folder list.
- Folder order must be user-adjustable and persisted. Reordering starts only from the right-side two-line drag handle, not from dragging the whole folder row.
- Trash button under the folder list.
- New note button.
- New folder button.
- Import buttons for Evernote and Google Keep.
- Search entry if search is implemented.

### Editor

Each note editor must include:

- Title input.
- Body editor.
- Bottom toolbar.
- Font size control.
- Font color control.
- Image insert button.
- Basic formatting controls: bold, italic, underline, bullet list, numbered list, link, undo, redo.
- The editor toolbar must support a Word-like hide/unhide control at the top middle of the toolbar.
- When editor tools are hidden, Undo, Redo, Save, and Delete must remain visible in the same row.
- Undo and Redo should use curved arrow icons and should not open the mobile keyboard when tapped.
- While typing long note content, the editor must auto-scroll before the caret reaches the visible bottom. Keep roughly three lines of breathing room above the sticky toolbar so the user never has to manually scroll down to continue typing.

### Note List

- The note list window should have a center-edge hide/unhide button.
- The hide/unhide button icon must reverse direction depending on the current state.
- The Move note dialog close button must dismiss the dialog and return to the note list.
- On mobile, the note list column must stay wide enough for Trash actions such as Restore all and Delete all. Do not add fixed button widths that clip action labels.
- In Trash, include a one-click restore action for all trashed notes in addition to permanent deletion.

Use compact icon buttons where possible. Avoid explanatory text inside the app UI unless it is necessary for an empty state, error, or confirmation dialog.

### Visual Style

- Dark mode only.
- Use restrained contrast and readable typography.
- Avoid a marketing-style landing page. The first screen should be the actual note app.
- The app should feel like a productivity tool: calm, fast, and focused.
- Make sure controls are large enough for touch on mobile.
- PWA icons must leave maskable safe-area padding. Do not let the central diary mark fill the whole icon, and bump the service worker cache whenever icon files change.

## Data Model

Use a normalized data model so imported notes and native notes can share the same editor and storage path.

### Note

Recommended fields:

- `id`: internal app ID.
- `source`: `native`, `evernote`, or `google_keep`.
- `sourceId`: original provider note ID when available.
- `folderId`: exactly one folder ID.
- `title`: note title.
- `body`: rich text body.
- `bodyFormat`: editor storage format, preferably HTML or a structured editor JSON format.
- `createdAt`: original creation timestamp. Must be preserved.
- `updatedAt`: latest modified timestamp.
- `sourceCreatedAt`: original provider creation timestamp.
- `sourceUpdatedAt`: original provider modified timestamp.
- `tags`: imported or user-created tags.
- `attachments`: list of attachment IDs.
- `metadata`: provider-specific data that should be preserved but not shown directly.
- `importedAt`: timestamp when the note was imported.
- `deletedAt`: timestamp when the note was moved to Trash, or null when active.
- `originalFolderId`: folder ID used when restoring a trashed note.
- `originalFolderName`: folder name captured when a note is trashed, used to rebuild a deleted folder during restore-all flows.

### Folder

Recommended fields:

- `id`: internal app ID.
- `name`: folder name.
- `createdAt`: folder creation time.
- `updatedAt`: folder modified time.
- `source`: `native`, `evernote`, or `google_keep` if created during import.
- `sourceId`: original notebook/folder ID when available.
- `sortOrder`: persisted folder order used for sidebar display and drag reordering.

### Attachment

Recommended fields:

- `id`: internal app ID.
- `noteId`: parent note ID.
- `source`: `native`, `evernote`, or `google_keep`.
- `sourceId`: provider attachment/resource ID when available.
- `fileName`: original or generated filename.
- `mimeType`: file type.
- `size`: file size when available.
- `storagePath`: local or remote storage path.
- `createdAt`: attachment creation/import time.
- `metadata`: provider-specific attachment data.

## Storage Recommendation

For a web app, use one of these approaches:

- MVP/local-first: browser IndexedDB for notes and attachments.
- Production/local-first: IndexedDB plus export/import backup.
- Multi-device/cloud: backend API with database and object storage.

If a backend is added, prefer:

- PostgreSQL or SQLite for structured metadata.
- Object storage for images and attachments.
- Server-side import jobs for Evernote and Google Keep.

Do not store image binary data directly inside note body content. Store attachments separately and reference them from note content.

## Import Requirements

### General Import Behavior

Imports must:

- Preserve original creation time.
- Preserve original modified time when available.
- Preserve tags.
- Preserve notebooks/folders when available.
- Preserve attachments and images.
- Preserve source metadata that may be useful later.
- Avoid overwriting native notes.
- Detect duplicate imports using provider source IDs.
- Provide a clear import progress state.
- Report import failures per note without stopping the entire import.

Imported notes should be editable after import, but the original creation timestamp must not change.

### Evernote Import

Requirement: the user clicks an Evernote import button and the app imports notes through an API-based flow.

Implementation decision:

- Use OAuth or the provider's current supported authorization method.
- Fetch notes, notebooks, tags, resources, creation timestamps, modified timestamps, and metadata through the API.
- Map Evernote notebooks to app folders.
- Map Evernote tags to app note tags.
- Convert Evernote note content into the app editor format.
- Download image resources and save them as attachments.

Important feasibility note:

Evernote API availability, permissions, and rate limits must be verified before implementation. If direct API access is unavailable or insufficient, add an `.enex` import fallback, but keep the primary product goal as one-click API import.

### Google Keep Import

Requirement: import Google Keep notes while preserving creation time, modified time, tags, notebooks/folders, attachments, and metadata.

Implementation decision:

- First investigate whether an official Google Keep API supports the needed data.
- If no suitable official API exists, support Google Takeout import as the reliable fallback.
- Google Keep labels should map to tags.
- If a Keep note has no folder/notebook concept, place it in a default `Google Keep` folder and preserve labels as tags.
- Preserve images and attachments when available from the import source.

Important feasibility note:

Google Keep does not have the same mature public import API surface as many Google products. The app should not depend on an unofficial scraping flow for core functionality. Prefer official API access if available; otherwise use Google Takeout import.

## Date And Time Handling

- Store timestamps in UTC internally.
- Preserve the original provider timestamp exactly in metadata.
- Display timestamps in the user's local timezone.
- Never modify `createdAt` after note creation or import.
- Update `updatedAt` only when the note content, title, folder, tags, or attachments change.

## Trash And Recovery

- A Trash button must appear under the folder list.
- Deleting a note moves it to Trash instead of deleting it permanently.
- Deleting a folder moves its notes to Trash and must preserve enough metadata to restore them later, including the original folder name.
- Trashed notes should be recoverable to their original folder when possible.
- If the original folder no longer exists, restore should recreate the original folder when the original folder name is known; otherwise restore to a default folder.
- Trash must provide a Restore all action that restores every trashed note in one step.
- Permanent deletion should only be available from Trash.

## Import Conflict Handling

When importing the same provider note more than once:

- Use `source` and `sourceId` to detect duplicates.
- If the imported note has not changed, skip it.
- If the provider note changed, update the existing imported note while preserving the original app `id`.
- If the local imported note was edited after import, do not overwrite it silently. Mark it as a conflict and let the user choose later.

## Features To Consider After MVP

- Full-text search across title and body.
- Tag filtering.
- Date filtering.
- Export all notes as Markdown, HTML, or JSON.
- Backup and restore.
- End-to-end encryption or local password lock.
- Pin/favorite notes.
- Bulk move notes between folders.
- Duplicate note.
- Keyboard shortcuts.
- Offline support with service worker.
- Cloud sync.
- OCR for imported images.

## Technical Guidance For Future Agents

- Keep the app usable before expanding import complexity.
- Build importers behind a common interface so Evernote, Google Keep, and future providers normalize into the same `Note`, `Folder`, and `Attachment` models.
- Treat provider APIs as unstable until verified with current documentation.
- Do not hard-code assumptions that all providers have notebooks, folders, tags, or attachments.
- Preserve source metadata even if the current UI does not show it.
- Add tests around import timestamp preservation, duplicate import handling, and attachment mapping.
- Use responsive layout checks before considering UI work complete.
- After changing `app.js`, `styles.css`, PWA icons, `manifest.json`, or `index.html`, bump `CACHE_NAME` in `sw.js` so installed mobile PWAs fetch the latest app shell.
- For mobile UI changes, verify narrow viewport behavior around the note list, Trash actions, sticky editor toolbar, browser Back behavior, and installed-PWA cache refresh.
