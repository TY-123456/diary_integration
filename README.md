# Diary Integration

`diary_integration` is a dark-mode note app designed for mobile-first diary and note migration workflows. It started from earlier Codex conversations about importing development notes into a mobile app and reviewing requirement gaps, then became this standalone project.

## What It Does

- Create, edit, save, delete, restore, and permanently remove notes.
- Organize notes by folders, including persisted drag reordering from the right-side folder handle.
- Recover notes from Trash individually or with Restore all after accidental folder deletion.
- Edit rich note content with undo, redo, bold, italic, underline, list style, font size, color, and image insertion.
- Auto-scroll long note editing before the caret reaches the bottom of the screen.
- Import and export sync data for moving notes between browser/mobile installs.
- Import Evernote `.enex` and Google Keep Takeout data on the web version.
- Install as a PWA on Android through Chrome's "Add to Home screen" flow.
- Preview the mobile UI locally with `mobile-preview.html`.

## Main Files

- `index.html`: app entry point.
- `app.js`: app state, note actions, import/export, editor behavior, and PWA logic.
- `styles.css`: desktop/mobile layout and visual design.
- `manifest.json` and `manifest.webmanifest`: Android/PWA install settings.
- `sw.js`: service worker and cache version.
- `mobile-preview.html`: development-only phone-frame preview.
- `icons/`: PWA app icons.

## Local Preview

For quick mobile layout checks, open:

```text
mobile-preview.html
```

The preview page loads `index.html` inside a phone frame and includes size controls:

- `360 x 720`
- `390 x 844`
- `430 x 932`
- Portrait / Landscape
- Reload

This file is only for development. It does not affect the installed Android app.

## Android Testing

After pushing changes to GitHub Pages:

1. Open the GitHub Pages URL on Android Chrome.
2. Open Chrome menu.
3. Choose `Add to Home screen`.
4. If Chrome shows an install option, choose `Install`.

If Android still shows an older app icon or old UI, remove the old home screen app and install it again. PWA icons and service worker cache can stay cached longer than normal page content.

When testing mobile behavior, check these flows before considering a change done:

- Folder reorder by dragging the two-line handle on the right side of a folder row.
- Trash action buttons, especially `Restore all` and `Delete all`, on narrow phone screens.
- Long note typing with the bottom toolbar visible; the editor should scroll while there are still about three lines left.
- App icon size after reinstalling the PWA.

Any change to the app shell should bump `CACHE_NAME` in `sw.js`; otherwise installed mobile PWAs may keep old `app.js`, `styles.css`, or icon files.

## GitHub Update Flow

Use the existing repository. Do not create a new repo.

```powershell
cd C:\Users\USER\Documents\diary_integration
git status --short --branch
git add .
git commit -m "Describe the change"
git push origin main
```

The current remote is:

```text
https://github.com/TY-123456/diary_integration.git
```

## Requirements And Project Notes

Durable project context lives in these files:

- `required.md`: original and current user-facing requirement summary.
- `AGENTS.md`: implementation guidance and product rules for future Codex work.
- `docs/review-required-gaps.md`: review findings, open questions, decisions, and risks.
- `docs/conversation-integration.md`: record of older Codex conversations merged into this project.

When requirements change, update the relevant doc instead of relying only on chat history.
