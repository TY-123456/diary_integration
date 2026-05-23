const DB_NAME = "diary-integration-db";
const DB_VERSION = 1;
const LEGACY_INBOX_FOLDER_ID = "folder-inbox";
const TRASH_FOLDER_ID = "trash";

const state = {
  db: null,
  folders: [],
  notes: [],
  activeFolderId: null,
  activeNoteId: null,
  search: "",
  saveTimer: null,
  pendingConfirmAction: null,
};

const els = {
  sidebar: document.querySelector("#sidebar"),
  openSidebar: document.querySelector("#openSidebar"),
  closeSidebar: document.querySelector("#closeSidebar"),
  newNoteButton: document.querySelector("#newNoteButton"),
  mobileNewNote: document.querySelector("#mobileNewNote"),
  newFolderButton: document.querySelector("#newFolderButton"),
  renameFolderButton: document.querySelector("#renameFolderButton"),
  deleteFolderButton: document.querySelector("#deleteFolderButton"),
  folderList: document.querySelector("#folderList"),
  trashButton: document.querySelector("#trashButton"),
  trashCount: document.querySelector("#trashCount"),
  moveNoteButton: document.querySelector("#moveNoteButton"),
  deleteAllTrashButton: document.querySelector("#deleteAllTrashButton"),
  collapseListButton: document.querySelector("#collapseListButton"),
  showListButton: document.querySelector("#showListButton"),
  moveDialog: document.querySelector("#moveDialog"),
  moveForm: document.querySelector("#moveForm"),
  closeMoveDialog: document.querySelector("#closeMoveDialog"),
  moveFolderList: document.querySelector("#moveFolderList"),
  searchInput: document.querySelector("#searchInput"),
  activeFolderLabel: document.querySelector("#activeFolderLabel"),
  noteCount: document.querySelector("#noteCount"),
  noteList: document.querySelector("#noteList"),
  emptyState: document.querySelector("#emptyState"),
  editorCard: document.querySelector("#editorCard"),
  exitScreen: document.querySelector("#exitScreen"),
  createdAtLabel: document.querySelector("#createdAtLabel"),
  updatedAtLabel: document.querySelector("#updatedAtLabel"),
  titleInput: document.querySelector("#titleInput"),
  bodyEditor: document.querySelector("#bodyEditor"),
  fontSizeSelect: document.querySelector("#fontSizeSelect"),
  fontColorInput: document.querySelector("#fontColorInput"),
  imageButton: document.querySelector("#imageButton"),
  imageInput: document.querySelector("#imageInput"),
  toolbarWrap: document.querySelector("#toolbarWrap"),
  bottomToolbar: document.querySelector("#bottomToolbar"),
  toolbarToggleButton: document.querySelector("#toolbarToggleButton"),
  saveNoteButton: document.querySelector("#saveNoteButton"),
  deleteNoteButton: document.querySelector("#deleteNoteButton"),
  evernoteImportInput: document.querySelector("#evernoteImportInput"),
  keepImportInput: document.querySelector("#keepImportInput"),
  backupButton: document.querySelector("#backupButton"),
  exitAppButton: document.querySelector("#exitAppButton"),
  restoreInput: document.querySelector("#restoreInput"),
  importStatus: document.querySelector("#importStatus"),
  folderDialog: document.querySelector("#folderDialog"),
  folderForm: document.querySelector("#folderForm"),
  folderDialogTitle: document.querySelector("#folderDialogTitle"),
  folderNameInput: document.querySelector("#folderNameInput"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmForm: document.querySelector("#confirmForm"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmActionButton: document.querySelector("#confirmActionButton"),
};

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function textFromHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent?.trim() || "";
}

function normalizeTitle(title, body = "", fallbackDate = "") {
  const cleanTitle = stripInvisibleText(title);
  if (cleanTitle) return cleanTitle;

  const preview = stripInvisibleText(textFromHtml(body));
  if (preview) return preview.slice(0, 80);

  return fallbackDate ? `Imported note ${formatDate(fallbackDate)}` : "Untitled";
}

function stripInvisibleText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compareNotesByCreatedDesc(a, b) {
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("folders")) {
        db.createObjectStore("folders", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("notes")) {
        const notes = db.createObjectStore("notes", { keyPath: "id" });
        notes.createIndex("folderId", "folderId", { unique: false });
        notes.createIndex("sourceId", ["source", "sourceId"], { unique: false });
      }
      if (!db.objectStoreNames.contains("attachments")) {
        db.createObjectStore("attachments", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(storeName, mode = "readonly") {
  return state.db.transaction(storeName, mode).objectStore(storeName);
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = tx(storeName, "readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function seedIfNeeded() {
  const notes = await getAll("notes");
  if (notes.length) return;
}

async function migrateLegacyInbox() {
  const folders = await getAll("folders");
  const legacyInbox = folders.find((folder) => folder.id === LEGACY_INBOX_FOLDER_ID || folder.name === "Inbox");
  if (!legacyInbox) return;

  const notes = await getAll("notes");
  const replacementFolder = await ensureStandaloneFolder("Imported");
  for (const note of notes.filter((item) => item.folderId === legacyInbox.id)) {
    await put("notes", { ...note, folderId: replacementFolder.id });
  }
  await remove("folders", legacyInbox.id);
}

async function removeOrphanNotes() {
  const folders = await getAll("folders");
  const folderIds = new Set(folders.map((folder) => folder.id));
  const notes = await getAll("notes");
  for (const note of notes) {
    if (note.deletedAt) continue;
    if (!note.folderId || !folderIds.has(note.folderId)) {
      await remove("notes", note.id);
    }
  }
}

async function loadState() {
  state.folders = (await getAll("folders")).sort((a, b) => a.name.localeCompare(b.name));
  state.notes = (await getAll("notes")).map(repairDisplayNote).sort(compareNotesByCreatedDesc);
  if (state.activeFolderId !== TRASH_FOLDER_ID && !state.folders.some((folder) => folder.id === state.activeFolderId)) {
    state.activeFolderId = state.folders[0]?.id || null;
  }
  const folderNotes = filteredNotes();
  if (!folderNotes.some((note) => note.id === state.activeNoteId)) {
    state.activeNoteId = folderNotes[0]?.id || null;
  }
  render();
}

function repairDisplayNote(note) {
  const repairedTitle = normalizeTitle(note.title, note.body, note.createdAt);
  return {
    ...note,
    title: repairedTitle,
    body: note.body || "",
    deletedAt: note.deletedAt || null,
    originalFolderId: note.originalFolderId || null,
  };
}

async function persistDisplayRepair(note) {
  const repaired = repairDisplayNote(note);
  if (repaired.title !== note.title || repaired.body !== note.body) {
    await put("notes", repaired);
  }
  return repaired;
}

function activeNote() {
  return state.notes.find((note) => note.id === state.activeNoteId) || null;
}

function activeFolder() {
  if (state.activeFolderId === TRASH_FOLDER_ID) {
    return { id: TRASH_FOLDER_ID, name: "Trash" };
  }
  return state.folders.find((folder) => folder.id === state.activeFolderId) || null;
}

function filteredNotes() {
  const query = state.search.trim().toLowerCase();
  return state.notes.filter((note) => {
    const isDeleted = Boolean(note.deletedAt);
    const folderMatches =
      state.activeFolderId === TRASH_FOLDER_ID
        ? isDeleted
        : state.activeFolderId && note.folderId === state.activeFolderId && !isDeleted;
    const queryMatches = !query || `${note.title} ${textFromHtml(note.body)}`.toLowerCase().includes(query);
    return folderMatches && queryMatches;
  });
}

function render() {
  renderFolders();
  renderMoveButton();
  renderNotes();
  renderEditor();
}

function renderFolders() {
  const buttons = state.folders.map((folder) => {
      const count = state.notes.filter((note) => note.folderId === folder.id && !note.deletedAt).length;
      return `<button class="folder-button ${state.activeFolderId === folder.id ? "active" : ""}" data-folder-id="${folder.id}"><span>${escapeHtml(folder.name)}</span><span>${count}</span></button>`;
    });
  els.folderList.innerHTML = buttons.join("");
  const trashCount = state.notes.filter((note) => note.deletedAt).length;
  els.trashCount.textContent = String(trashCount);
  els.trashButton.classList.toggle("active", state.activeFolderId === TRASH_FOLDER_ID);
}

function renderMoveButton() {
  const note = activeNote();
  const inTrash = state.activeFolderId === TRASH_FOLDER_ID;
  els.moveNoteButton.hidden = inTrash;
  els.deleteAllTrashButton.hidden = !inTrash;
  els.deleteAllTrashButton.disabled = !state.notes.some((item) => item.deletedAt);
  els.moveNoteButton.disabled = !note || state.folders.length < 2;

  const hasActiveFolder = Boolean(activeFolder()) && !inTrash;
  els.renameFolderButton.disabled = !hasActiveFolder;
  els.deleteFolderButton.disabled = !hasActiveFolder;
}

function renderNotes() {
  const notes = filteredNotes();
  const folder = activeFolder();
  els.activeFolderLabel.textContent = folder ? folder.name : "Choose a folder";
  els.noteCount.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;

  if (!notes.length) {
    els.noteList.innerHTML = `<div class="note-card"><strong>No notes</strong><span>Create a note or import a file.</span></div>`;
    return;
  }

  els.noteList.innerHTML = notes
    .map((note) => {
      const title = normalizeTitle(note.title, note.body, note.createdAt);
      return `
        <button class="note-card ${note.id === state.activeNoteId ? "active" : ""}" data-note-id="${note.id}">
          <strong>${escapeHtml(title)}</strong>
        </button>
      `;
    })
    .join("");
}

function renderEditor() {
  const note = activeNote();
  els.emptyState.hidden = Boolean(note);
  els.editorCard.hidden = !note;

  if (!note) return;

  if (document.activeElement !== els.titleInput) {
    els.titleInput.value = note.title || "";
  }
  if (document.activeElement !== els.bodyEditor && els.bodyEditor.innerHTML !== note.body) {
    els.bodyEditor.innerHTML = note.body || "";
  }
  els.createdAtLabel.textContent = `Created ${formatDate(note.createdAt)}`;
  els.updatedAtLabel.textContent = note.deletedAt ? `In trash ${formatDate(note.deletedAt)}` : `Updated ${formatDate(note.updatedAt)}`;
  els.saveNoteButton.textContent = note.deletedAt ? "Restore" : "Save";
  els.saveNoteButton.title = note.deletedAt ? "Restore note" : "Save note";
  els.deleteNoteButton.textContent = note.deletedAt ? "Delete Forever" : "Delete";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function createFolder() {
  openFolderDialog("create");
}

async function saveFolderFromDialog(event) {
  event.preventDefault();
  const mode = els.folderDialog.dataset.mode;
  const name = stripInvisibleText(els.folderNameInput.value);
  if (!name) return;

  const timestamp = nowIso();
  if (mode === "rename") {
    const folder = activeFolder();
    if (!folder) return;
    await put("folders", {
      ...folder,
      name,
      updatedAt: timestamp,
    });
  } else {
    const folder = {
      id: uid("folder"),
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: "native",
      sourceId: null,
    };
    await put("folders", folder);
  }
  els.folderDialog.close();
  await loadState();
}

function openFolderDialog(mode) {
  const folder = activeFolder();
  els.folderDialog.dataset.mode = mode;
  els.folderDialogTitle.textContent = mode === "rename" ? "Rename folder" : "New folder";
  els.folderNameInput.value = mode === "rename" && folder ? folder.name : "";
  els.folderDialog.showModal();
  setTimeout(() => els.folderNameInput.focus(), 0);
}

async function ensureStandaloneFolder(name) {
  const folders = await getAll("folders");
  const existing = folders.find((folder) => folder.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const timestamp = nowIso();
  const folder = {
    id: uid("folder"),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: "native",
    sourceId: null,
  };
  await put("folders", folder);
  return folder;
}

async function renameActiveFolder() {
  const folder = activeFolder();
  if (!folder) return;
  openFolderDialog("rename");
}

async function deleteActiveFolder() {
  const folder = activeFolder();
  if (!folder || folder.id === TRASH_FOLDER_ID) return;

  const notesInFolder = state.notes.filter((note) => note.folderId === folder.id && !note.deletedAt).length;
  const ok = await confirmAction({
    title: "Delete folder",
    message: `Move "${folder.name}" and ${notesInFolder} note(s) to Trash?`,
    actionLabel: "Delete",
  });
  if (!ok) return;

  const timestamp = nowIso();
  for (const note of state.notes.filter((item) => item.folderId === folder.id && !item.deletedAt)) {
    await put("notes", {
      ...note,
      deletedAt: timestamp,
      originalFolderId: folder.id,
      updatedAt: timestamp,
    });
  }
  await remove("folders", folder.id);
  state.activeFolderId = state.folders.find((item) => item.id !== folder.id)?.id || null;
  state.activeNoteId = null;
  await loadState();
}

async function createNote() {
  let folderId = state.activeFolderId;
  if (folderId === TRASH_FOLDER_ID) {
    folderId = state.folders[0]?.id || null;
  }
  if (!folderId) {
    const folder = await ensureStandaloneFolder("Notes");
    folderId = folder.id;
    state.activeFolderId = folderId;
  }
  const timestamp = nowIso();
  const note = {
    id: uid("note"),
    source: "native",
    sourceId: null,
    folderId,
    title: "Untitled",
    body: "",
    bodyFormat: "html",
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceCreatedAt: null,
    sourceUpdatedAt: null,
    tags: [],
    attachments: [],
    metadata: {},
    importedAt: null,
  };
  await put("notes", note);
  state.activeNoteId = note.id;
  state.activeFolderId = folderId;
  els.sidebar.classList.remove("open");
  enterContentState();
  await loadState();
  els.titleInput.focus();
}

function scheduleNoteSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveCurrentNote, 250);
}

async function saveCurrentNote() {
  const note = activeNote();
  if (!note || note.deletedAt) return;

  const updated = {
    ...note,
    title: els.titleInput.value.trim() || "Untitled",
    body: els.bodyEditor.innerHTML,
    updatedAt: nowIso(),
  };
  await put("notes", updated);
  const index = state.notes.findIndex((item) => item.id === updated.id);
  state.notes[index] = updated;
  state.notes.sort(compareNotesByCreatedDesc);
  renderNotes();
  renderMoveButton();
  els.updatedAtLabel.textContent = `Updated ${formatDate(updated.updatedAt)}`;
}

async function moveCurrentNote(folderId) {
  const note = activeNote();
  if (!note || note.deletedAt || !state.folders.some((folder) => folder.id === folderId)) return;
  await put("notes", { ...note, folderId, updatedAt: nowIso() });
  state.activeFolderId = folderId;
  await loadState();
}

function openMoveDialog() {
  const note = activeNote();
  if (!note) return;

  els.moveFolderList.innerHTML = state.folders
    .filter((folder) => folder.id !== note.folderId)
    .map((folder) => {
      const count = state.notes.filter((item) => item.folderId === folder.id).length;
      return `<button value="${folder.id}" class="move-folder-button"><span>${escapeHtml(folder.name)}</span><span>${count}</span></button>`;
    })
    .join("");

  if (!els.moveFolderList.innerHTML) {
    els.moveFolderList.innerHTML = `<p class="move-empty">Create another folder first.</p>`;
  }
  els.moveDialog.showModal();
}

async function submitMoveDialog(event) {
  event.preventDefault();
  const button = event.submitter;
  if (!button?.value || button.value === "cancel") {
    closeMoveDialog();
    return;
  }
  await moveCurrentNote(button.value);
  els.moveDialog.close();
}

async function deleteCurrentNote() {
  const note = activeNote();
  if (!note) return;
  if (note.deletedAt) {
    const ok = await confirmAction({
      title: "Delete forever",
      message: `Permanently delete "${note.title || "Untitled"}"? This cannot be recovered.`,
      actionLabel: "Delete Forever",
    });
    if (!ok) return;
    await remove("notes", note.id);
    const nextNote = filteredNotes().find((item) => item.id !== note.id);
    state.activeNoteId = nextNote?.id || null;
    await loadState();
    return;
  }

  const ok = await confirmAction({
    title: "Delete note",
    message: `Move "${note.title || "Untitled"}" to Trash? You can recover it later.`,
    actionLabel: "Delete",
  });
  if (!ok) return;
  const timestamp = nowIso();
  await put("notes", {
    ...note,
    deletedAt: timestamp,
    originalFolderId: note.folderId,
    updatedAt: timestamp,
  });
  const nextNote = filteredNotes().find((item) => item.id !== note.id);
  state.activeNoteId = nextNote?.id || null;
  await loadState();
}

async function deleteAllTrashNotes() {
  const trashedNotes = state.notes.filter((note) => note.deletedAt);
  if (!trashedNotes.length) return;
  const ok = await confirmAction({
    title: "Delete all trash",
    message: `Permanently delete ${trashedNotes.length} trashed note(s)? This cannot be recovered.`,
    actionLabel: "Delete All",
  });
  if (!ok) return;
  await Promise.all(trashedNotes.map((note) => remove("notes", note.id)));
  state.activeNoteId = null;
  await loadState();
}

async function restoreCurrentNote() {
  const note = activeNote();
  if (!note?.deletedAt) return;
  let folderId = note.originalFolderId && state.folders.some((folder) => folder.id === note.originalFolderId) ? note.originalFolderId : null;
  if (!folderId) {
    const folder = state.folders[0] || (await ensureStandaloneFolder("Notes"));
    folderId = folder.id;
  }
  const timestamp = nowIso();
  await put("notes", {
    ...note,
    folderId,
    deletedAt: null,
    originalFolderId: null,
    updatedAt: timestamp,
  });
  state.activeFolderId = folderId;
  state.activeNoteId = note.id;
  await loadState();
}

function closeMoveDialog() {
  els.moveDialog.close();
  toggleNoteList(true);
}

function confirmAction({ title, message, actionLabel }) {
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  els.confirmActionButton.textContent = actionLabel;
  els.confirmDialog.showModal();

  return new Promise((resolve) => {
    state.pendingConfirmAction = resolve;
  });
}

function submitConfirmDialog(event) {
  event.preventDefault();
  const confirmed = event.submitter?.value === "confirm";
  els.confirmDialog.close();
  if (state.pendingConfirmAction) {
    state.pendingConfirmAction(confirmed);
    state.pendingConfirmAction = null;
  }
}

function toggleToolbarTools(show) {
  els.toolbarWrap.classList.toggle("tools-collapsed", !show);
  els.toolbarToggleButton.textContent = show ? "v" : "^";
  els.toolbarToggleButton.setAttribute("aria-label", show ? "Hide editor tools" : "Show editor tools");
  els.toolbarToggleButton.title = show ? "Hide editor tools" : "Show editor tools";
}

function toggleNoteList(show) {
  document.body.classList.toggle("note-list-collapsed", !show);
  els.collapseListButton.textContent = show ? "<" : ">";
  els.collapseListButton.setAttribute("aria-label", show ? "Hide note list" : "Show note list");
  els.showListButton.hidden = true;
}

async function saveOrRestoreNoteAndReturnToMenu() {
  const note = activeNote();
  if (note?.deletedAt) {
    await restoreCurrentNote();
    return;
  }
  await saveCurrentNote();
  returnToMenuOnMobile();
}

async function exitApp() {
  if (activeNote() && !activeNote().deletedAt) {
    await saveCurrentNote();
  }
  els.sidebar.classList.remove("open");
  document.body.classList.add("app-exited");
  els.exitScreen.hidden = false;
  window.open("", "_self");
  window.close();
}
function runCommand(command) {
  const shouldRestoreFocus = command !== "undo" && command !== "redo";
  if (command === "createLink") {
    const url = prompt("Link URL");
    if (!url) return;
    document.execCommand(command, false, url);
  } else {
    document.execCommand(command, false, null);
  }
  if (shouldRestoreFocus) {
    els.bodyEditor.focus();
  }
  scheduleNoteSave();
}

function applyFontSize(value) {
  if (!value) return;
  document.execCommand("fontSize", false, value);
  els.bodyEditor.focus();
  scheduleNoteSave();
  els.fontSizeSelect.value = "";
}

function applyFontColor(value) {
  document.execCommand("foreColor", false, value);
  els.bodyEditor.focus();
  scheduleNoteSave();
}

function insertImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    document.execCommand("insertImage", false, reader.result);
    scheduleNoteSave();
  };
  reader.readAsDataURL(file);
}

function showImportMessage(message) {
  els.importStatus.textContent = message;
}

function returnToMenuOnMobile() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    els.sidebar.classList.add("open");
  }
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function openMenu() {
  els.sidebar.classList.add("open");
}

function enterContentState() {
  if (!isMobileLayout()) return;
  if (history.state?.diaryView !== "content") {
    history.pushState({ diaryView: "content" }, "");
  }
}

function prepareMobileBackState() {
  if (!isMobileLayout() || history.state?.diaryView) return;
  history.replaceState({ diaryView: "menu" }, "");
  history.pushState({ diaryView: "content" }, "");
}

function handleMobileBack() {
  if (!isMobileLayout()) return;
  openMenu();
}

async function importFiles(provider, providerName, files) {
  const fileList = Array.from(files);
  if (!fileList.length) return;

  let imported = 0;
  let firstImportedNoteId = null;
  try {
    for (const file of fileList) {
      let result;
      if (provider === "evernote") {
        result = await importEvernoteEnex(file);
      } else {
        result = await importKeepFile(file);
      }
      imported += result.count;
      firstImportedNoteId ||= result.firstNoteId;
    }
    if (firstImportedNoteId) {
      const importedNote = state.notes.find((note) => note.id === firstImportedNoteId) || (await getAll("notes")).find((note) => note.id === firstImportedNoteId);
      state.activeNoteId = firstImportedNoteId;
      state.activeFolderId = importedNote?.folderId || state.activeFolderId;
    }
    showImportMessage(`Success: ${providerName} import finished. ${imported} note(s) imported or updated.`);
  } catch (error) {
    showImportMessage(`Fail: ${error.message || `${providerName} import failed.`}`);
  } finally {
    await loadState();
    returnToMenuOnMobile();
  }
}

async function importProviderJson(provider, providerName, file) {
  const payload = JSON.parse(await file.text());
  const importedAt = nowIso();
  const folderCache = new Map(state.folders.map((folder) => [folder.name.toLowerCase(), folder]));
  const externalNotes = extractExternalNotes(payload);
  let importedCount = 0;
  let firstNoteId = null;

  if (!externalNotes.length) {
    throw new Error("No notes found in the selected JSON file.");
  }

  for (const external of externalNotes) {
    const normalized = normalizeExternalNote(external, provider, providerName, importedAt);
    const folder = await ensureImportFolder(normalized.folderName, provider, folderCache);
    const existing = findExistingImportedNote(provider, normalized.sourceId);
    const note = {
      ...(existing || {}),
      id: existing?.id || uid("note"),
      source: provider,
      sourceId: normalized.sourceId,
      folderId: folder.id,
      title: normalized.title,
      body: normalized.body,
      bodyFormat: "html",
      createdAt: existing?.createdAt || normalized.createdAt,
      updatedAt: normalized.updatedAt,
      sourceCreatedAt: normalized.sourceCreatedAt,
      sourceUpdatedAt: normalized.sourceUpdatedAt,
      tags: normalized.tags,
      attachments: existing?.attachments || [],
      metadata: normalized.metadata,
      importedAt: existing?.importedAt || importedAt,
    };
    await put("notes", note);
    firstNoteId ||= note.id;
    importedCount += 1;
  }

  return { count: importedCount, firstNoteId };
}

async function importEvernoteEnex(file) {
  const xml = await file.text();
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error(`Could not read ${file.name} as ENEX.`);
  }

  const notes = Array.from(doc.querySelectorAll("note"));
  const importedAt = nowIso();
  const folderCache = new Map(state.folders.map((folder) => [folder.name.toLowerCase(), folder]));
  let importedCount = 0;
  let firstNoteId = null;

  for (const noteNode of notes) {
    const createdAt = parseEvernoteDate(childText(noteNode, "created")) || importedAt;
    const updatedAt = parseEvernoteDate(childText(noteNode, "updated")) || createdAt;
    const tags = Array.from(noteNode.querySelectorAll(":scope > tag")).map((tag) => tag.textContent.trim()).filter(Boolean);
    const content = childText(noteNode, "content");
    const resources = Array.from(noteNode.querySelectorAll(":scope > resource")).map(readEvernoteResource);
    const body = convertEvernoteContent(content, resources);
    const title = normalizeTitle(childText(noteNode, "title"), body, createdAt);
    const folderName = file.name.replace(/\.enex$/i, "") || "Evernote";
    const folder = await ensureImportFolder(folderName, "evernote", folderCache);
    const sourceId = `enex:${file.name}:${title}:${createdAt}`;
    const existing = findExistingImportedNote("evernote", sourceId);
    const note = {
      ...(existing || {}),
      id: existing?.id || uid("note"),
      source: "evernote",
      sourceId,
      folderId: folder.id,
      title,
      body,
      bodyFormat: "html",
      createdAt: existing?.createdAt || createdAt,
      updatedAt,
      sourceCreatedAt: createdAt,
      sourceUpdatedAt: updatedAt,
      tags,
      attachments: resources.map((resource) => resource.id),
      metadata: {
        provider: "Evernote",
        fileName: file.name,
        resources: resources.map(({ dataUrl, data, ...resource }) => resource),
      },
      importedAt: existing?.importedAt || importedAt,
    };
    await put("notes", note);
    firstNoteId ||= note.id;
    importedCount += 1;
  }

  return { count: importedCount, firstNoteId };
}

async function importKeepFile(file) {
  if (/\.html?$/i.test(file.name) || file.type === "text/html") {
    return importKeepHtml(file);
  }
  return importProviderJson("google_keep", "Google Keep", file);
}

async function importKeepHtml(file) {
  const html = await file.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim() || file.name.replace(/\.html?$/i, "") || "Untitled";
  const bodyNode = doc.body?.cloneNode(true);
  if (!bodyNode) {
    throw new Error(`Could not read ${file.name} as Google Keep HTML.`);
  }

  bodyNode.querySelectorAll("script, style").forEach((node) => node.remove());
  const importedAt = nowIso();
  const folderCache = new Map(state.folders.map((folder) => [folder.name.toLowerCase(), folder]));
  const folder = await ensureImportFolder("Google Keep", "google_keep", folderCache);
  const sourceId = `keep-html:${file.name}`;
  const existing = findExistingImportedNote("google_keep", sourceId);
  const note = {
    ...(existing || {}),
    id: existing?.id || uid("note"),
    source: "google_keep",
    sourceId,
    folderId: folder.id,
    title,
    body: bodyNode.innerHTML || `<p>${escapeHtml(bodyNode.textContent || "")}</p>`,
    bodyFormat: "html",
    createdAt: existing?.createdAt || importedAt,
    updatedAt: importedAt,
    sourceCreatedAt: importedAt,
    sourceUpdatedAt: importedAt,
    tags: [],
    attachments: existing?.attachments || [],
    metadata: {
      provider: "Google Keep",
      fileName: file.name,
      format: "html",
    },
    importedAt: existing?.importedAt || importedAt,
  };
  await put("notes", note);
  return { count: 1, firstNoteId: note.id };
}

function extractExternalNotes(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.notes)) return payload.notes;
  if (Array.isArray(payload.items)) return payload.items;
  if (payload.title || payload.textContent || payload.content || payload.body) return [payload];
  return [];
}

async function ensureImportFolder(folderName, provider, folderCache) {
  const cleanName = folderName?.trim() || (provider === "google_keep" ? "Google Keep" : "Evernote");
  const cacheKey = cleanName.toLowerCase();
  const existing = folderCache.get(cacheKey);
  if (existing) return existing;

  const timestamp = nowIso();
  const folder = {
    id: uid("folder"),
    name: cleanName,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: provider,
    sourceId: cleanName,
  };
  await put("folders", folder);
  folderCache.set(cacheKey, folder);
  state.folders.push(folder);
  return folder;
}

function findExistingImportedNote(provider, sourceId) {
  return state.notes.find((note) => note.source === provider && note.sourceId === sourceId);
}

function normalizeExternalNote(external, provider, providerName, importedAt) {
  const title = external.title || external.name || "Untitled";
  const sourceId = String(external.id || external.guid || external.sourceId || `${provider}-${title}-${external.createdAt || importedAt}`);
  const createdAt = normalizeTimestamp(
    external.createdAt || external.created || external.createdTime || external.createdTimestampUsec || external.userCreatedTimestampUsec || importedAt
  );
  const updatedAt = normalizeTimestamp(
    external.updatedAt || external.updated || external.modifiedAt || external.modified || external.userEditedTimestampUsec || createdAt
  );
  const rawBody = getExternalBody(external);
  const body = looksLikeHtml(rawBody) ? rawBody : `<p>${escapeHtml(String(rawBody)).replaceAll("\n", "<br>")}</p>`;
  const tags = normalizeTags(external.tags || external.labels || external.labelNames);
  const folderName = external.folder || external.folderName || external.notebook || external.notebookName || providerName;

  return {
    sourceId,
    title: String(title),
    body,
    createdAt,
    updatedAt,
    sourceCreatedAt: createdAt,
    sourceUpdatedAt: updatedAt,
    tags,
    folderName,
    metadata: {
      provider: providerName,
      original: external,
      attachments: external.attachments || external.blobs || [],
      color: external.color || "",
      isPinned: Boolean(external.isPinned || external.pinned),
      isArchived: Boolean(external.isArchived || external.archived),
      collaborators: external.collaborators || [],
    },
  };
}

function getExternalBody(external) {
  if (external.body || external.content || external.html || external.textContent || external.text) {
    return external.body || external.content || external.html || external.textContent || external.text;
  }

  if (Array.isArray(external.listContent)) {
    const items = external.listContent
      .map((item) => {
        const checked = item.isChecked || item.checked ? "x" : " ";
        return `[${checked}] ${item.text || item.name || ""}`;
      })
      .filter((line) => line.trim() !== "[]");
    return items.join("\n");
  }

  return "";
}

function childText(node, selector) {
  const child = directChild(node, selector) || node.querySelector(selector);
  return child?.textContent?.trim() || "";
}

function directChild(node, name) {
  return Array.from(node.children || []).find((child) => {
    const localName = child.localName || child.tagName;
    return localName?.toLowerCase() === name.toLowerCase();
  });
}

function parseEvernoteDate(value) {
  if (!value) return "";
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return normalizeTimestamp(value);
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
}

function convertEvernoteContent(content, resources = []) {
  const cleanContent = String(content || "").trim();
  if (!cleanContent) return "";

  const doc = new DOMParser().parseFromString(cleanContent, "text/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    return convertEvernoteContentFallback(cleanContent);
  }

  let resourceIndex = 0;
  doc.querySelectorAll("en-media").forEach((node) => {
    const hash = node.getAttribute("hash");
    const resource =
      resources.find((item) => item.hash && item.hash === hash) ||
      resources.slice(resourceIndex).find((item) => item.mimeType?.startsWith("image/")) ||
      resources[resourceIndex];
    resourceIndex += 1;

    let replacement;
    if (resource?.dataUrl && resource.mimeType?.startsWith("image/")) {
      replacement = doc.createElement("img");
      replacement.setAttribute("src", resource.dataUrl);
      replacement.setAttribute("alt", resource.fileName || "Imported Evernote image");
    } else {
      replacement = doc.createElement("p");
      replacement.textContent = resource?.fileName ? `[Imported attachment: ${resource.fileName}]` : "[Imported Evernote attachment]";
    }
    node.replaceWith(replacement);
  });

  const body = doc.querySelector("en-note");
  if (!body) return convertEvernoteContentFallback(cleanContent);

  const serialized = serializeChildren(body).trim();
  return serialized || `<p>${escapeHtml(body.textContent || "")}</p>`;
}

function convertEvernoteContentFallback(content) {
  const match = content.match(/<en-note[^>]*>([\s\S]*?)<\/en-note>/i);
  if (match?.[1]?.trim()) return match[1].trim();
  return `<pre>${escapeHtml(content)}</pre>`;
}

function serializeChildren(node) {
  const serializer = new XMLSerializer();
  return Array.from(node.childNodes)
    .map((child) => {
      if (child.nodeType === Node.TEXT_NODE) return escapeHtml(child.textContent || "");
      return serializer.serializeToString(child);
    })
    .join("");
}

function readEvernoteResource(resourceNode) {
  const mimeType = childText(resourceNode, "mime");
  const dataNode = directChild(resourceNode, "data");
  const data = (dataNode?.textContent || "").replace(/\s+/g, "");
  const fileName =
    resourceNode.querySelector("resource-attributes > file-name")?.textContent?.trim() ||
    resourceNode.querySelector("file-name")?.textContent?.trim() ||
    "";
  const hash = dataNode?.getAttribute("hash") || dataNode?.getAttribute("bodyHash") || "";

  return {
    id: uid("attachment"),
    mimeType,
    width: childText(resourceNode, "width"),
    height: childText(resourceNode, "height"),
    fileName,
    data,
    dataUrl: data && mimeType ? `data:${mimeType};base64,${data}` : "",
    hash,
  };
}

function normalizeTimestamp(value) {
  if (!value) return nowIso();
  if (typeof value === "number") {
    const milliseconds = value > 9999999999999 ? Math.floor(value / 1000) : value;
    return new Date(milliseconds).toISOString();
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && value !== "") {
    return normalizeTimestamp(numeric);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? nowIso() : parsed.toISOString();
}

function normalizeTags(value) {
  if (!value) return [];
  const tags = Array.isArray(value) ? value : String(value).split(",");
  return tags
    .map((tag) => (typeof tag === "string" ? tag : tag.name || tag.title || tag.label))
    .filter(Boolean)
    .map((tag) => String(tag).trim())
    .filter(Boolean);
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value));
}

function exportFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fallback = `diary-sync-${stamp}.json`;
  const entered = prompt("Export sync file name", fallback);
  if (entered === null) return null;
  const cleanName = entered
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .slice(0, 120);
  if (!cleanName) return fallback;
  return cleanName.toLowerCase().endsWith(".json") ? cleanName : `${cleanName}.json`;
}
async function exportBackup() {
  const payload = {
    exportedAt: nowIso(),
    version: 2,
    app: "diary-integration",
    device: getDeviceLabel(),
    folders: state.folders,
    notes: state.notes,
  };
  const fileName = exportFileName();
  if (!fileName) return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });

  if (navigator.canShare && navigator.share) {
    const file = new File([blob], fileName, { type: "application/json" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Diary sync file" });
        showImportMessage("Success: sync file exported.");
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  showImportMessage("Success: sync file exported.");
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

async function restoreBackup(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.folders) || !Array.isArray(payload.notes)) {
      throw new Error("Invalid backup format");
    }
    const result = await mergeBackupPayload(payload);
    showImportMessage(`Success: sync imported. ${result.notesAdded} added, ${result.notesUpdated} updated, ${result.notesSkipped} unchanged.`);
    await loadState();
  } catch (error) {
    showImportMessage(`Fail: ${error.message || "Could not import sync file."}`);
  } finally {
    returnToMenuOnMobile();
  }
}

async function mergeBackupPayload(payload) {
  const existingFolders = await getAll("folders");
  const existingNotes = await getAll("notes");
  const folderIdMap = new Map();
  let notesAdded = 0;
  let notesUpdated = 0;
  let notesSkipped = 0;

  for (const incomingFolder of payload.folders) {
    const folder = normalizeImportedFolder(incomingFolder);
    const existing =
      existingFolders.find((item) => item.id === folder.id) ||
      existingFolders.find((item) => item.name.toLowerCase() === folder.name.toLowerCase());

    if (existing) {
      folderIdMap.set(folder.id, existing.id);
      const mergedFolder = newestByUpdatedAt(existing, folder);
      await put("folders", { ...existing, ...mergedFolder, id: existing.id });
    } else {
      folderIdMap.set(folder.id, folder.id);
      existingFolders.push(folder);
      await put("folders", folder);
    }
  }

  for (const incomingNote of payload.notes) {
    const note = normalizeImportedNote(incomingNote, folderIdMap, existingFolders);
    if (!note.folderId) {
      const folder = await ensureStandaloneFolder("Imported");
      note.folderId = folder.id;
      if (!existingFolders.some((item) => item.id === folder.id)) {
        existingFolders.push(folder);
      }
    }
    const existing =
      existingNotes.find((item) => item.id === note.id) ||
      existingNotes.find((item) => item.source === note.source && item.sourceId && item.sourceId === note.sourceId);

    if (!existing) {
      existingNotes.push(note);
      await put("notes", note);
      notesAdded += 1;
      continue;
    }

    if (sameNoteContent(existing, note)) {
      notesSkipped += 1;
      continue;
    }

    const mergedNote = newestByUpdatedAt(existing, note);
    await put("notes", { ...existing, ...mergedNote, id: existing.id });
    notesUpdated += 1;
  }

  return { notesAdded, notesUpdated, notesSkipped };
}

function normalizeImportedFolder(folder) {
  const timestamp = nowIso();
  return {
    id: folder.id || uid("folder"),
    name: stripInvisibleText(folder.name) || "Imported",
    createdAt: folder.createdAt || timestamp,
    updatedAt: folder.updatedAt || folder.createdAt || timestamp,
    source: folder.source || "native",
    sourceId: folder.sourceId || null,
  };
}

function normalizeImportedNote(note, folderIdMap, existingFolders) {
  const fallbackFolder = existingFolders[0] || null;
  const mappedFolderId = folderIdMap.get(note.folderId) || fallbackFolder?.id || null;
  const timestamp = nowIso();

  return repairDisplayNote({
    id: note.id || uid("note"),
    source: note.source || "native",
    sourceId: note.sourceId || null,
    folderId: mappedFolderId,
    title: note.title || "",
    body: note.body || "",
    bodyFormat: note.bodyFormat || "html",
    createdAt: note.createdAt || timestamp,
    updatedAt: note.updatedAt || note.createdAt || timestamp,
    sourceCreatedAt: note.sourceCreatedAt || null,
    sourceUpdatedAt: note.sourceUpdatedAt || null,
    tags: Array.isArray(note.tags) ? note.tags : [],
    attachments: Array.isArray(note.attachments) ? note.attachments : [],
    metadata: note.metadata || {},
    importedAt: note.importedAt || null,
    deletedAt: note.deletedAt || null,
    originalFolderId: note.originalFolderId || null,
  });
}

function newestByUpdatedAt(current, incoming) {
  const currentTime = new Date(current.updatedAt || current.createdAt || 0).getTime();
  const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();
  return incomingTime > currentTime ? incoming : current;
}

function sameNoteContent(a, b) {
  return (
    a.title === b.title &&
    a.body === b.body &&
    a.folderId === b.folderId &&
    JSON.stringify(a.tags || []) === JSON.stringify(b.tags || []) &&
    String(a.updatedAt || "") === String(b.updatedAt || "")
  );
}

function getDeviceLabel() {
  const existing = localStorage.getItem("diary-device-label");
  if (existing) return existing;

  const label = `Device ${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  localStorage.setItem("diary-device-label", label);
  return label;
}

function bindEvents() {
  els.openSidebar.addEventListener("click", () => openMenu());
  els.closeSidebar.addEventListener("click", () => els.sidebar.classList.remove("open"));
  els.newNoteButton.addEventListener("click", createNote);
  els.mobileNewNote.addEventListener("click", createNote);
  els.newFolderButton.addEventListener("click", createFolder);
  els.folderForm.addEventListener("submit", saveFolderFromDialog);
  els.renameFolderButton.addEventListener("click", renameActiveFolder);
  els.deleteFolderButton.addEventListener("click", deleteActiveFolder);
  els.confirmForm.addEventListener("submit", submitConfirmDialog);
  els.toolbarToggleButton.addEventListener("click", () => toggleToolbarTools(els.toolbarWrap.classList.contains("tools-collapsed")));
  els.collapseListButton.addEventListener("click", () => toggleNoteList(document.body.classList.contains("note-list-collapsed")));
  els.showListButton.addEventListener("click", () => toggleNoteList(true));
  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderNotes();
  });
  els.trashButton.addEventListener("click", () => {
    state.activeFolderId = TRASH_FOLDER_ID;
    state.activeNoteId = filteredNotes()[0]?.id || null;
    els.sidebar.classList.remove("open");
    enterContentState();
    render();
  });
  els.folderList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-folder-id]");
    if (!button) return;
    state.activeFolderId = button.dataset.folderId;
    els.sidebar.classList.remove("open");
    enterContentState();
    render();
  });
  els.noteList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-note-id]");
    if (!button) return;
    state.activeNoteId = button.dataset.noteId;
    enterContentState();
    render();
  });
  els.moveNoteButton.addEventListener("click", openMoveDialog);
  els.deleteAllTrashButton.addEventListener("click", deleteAllTrashNotes);
  els.moveForm.addEventListener("submit", submitMoveDialog);
  els.closeMoveDialog.addEventListener("click", (event) => {
    event.preventDefault();
    closeMoveDialog();
  });
  els.titleInput.addEventListener("input", scheduleNoteSave);
  els.bodyEditor.addEventListener("input", scheduleNoteSave);
  document.querySelector(".bottom-toolbar").addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-command], #saveNoteButton, #deleteNoteButton, #toolbarToggleButton")) {
      event.preventDefault();
    }
  });
  document.querySelector(".bottom-toolbar").addEventListener("click", (event) => {
    const commandButton = event.target.closest("[data-command]");
    if (!commandButton) return;
    runCommand(commandButton.dataset.command);
  });
  els.fontSizeSelect.addEventListener("change", (event) => applyFontSize(event.target.value));
  els.fontColorInput.addEventListener("input", (event) => applyFontColor(event.target.value));
  els.imageButton.addEventListener("click", () => els.imageInput.click());
  els.imageInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) insertImage(file);
    event.target.value = "";
  });
  els.saveNoteButton.addEventListener("click", saveOrRestoreNoteAndReturnToMenu);
  els.deleteNoteButton.addEventListener("click", deleteCurrentNote);
  els.exitAppButton.addEventListener("click", exitApp);
  els.evernoteImportInput.addEventListener("change", (event) => {
    importFiles("evernote", "Evernote", event.target.files);
    event.target.value = "";
  });
  els.keepImportInput.addEventListener("change", (event) => {
    importFiles("google_keep", "Google Keep", event.target.files);
    event.target.value = "";
  });
  els.backupButton.addEventListener("click", exportBackup);
  els.restoreInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) restoreBackup(file);
    event.target.value = "";
  });
  window.addEventListener("popstate", handleMobileBack);
}

async function init() {
  state.db = await openDatabase();
  await seedIfNeeded();
  await migrateLegacyInbox();
  await removeOrphanNotes();
  bindEvents();
  registerServiceWorker();
  await loadState();
  prepareMobileBackState();
  returnToMenuOnMobile();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./sw.js").catch(() => {
    showImportMessage("Offline install cache is unavailable in this browser context.");
  });
}

init().catch((error) => {
  document.body.innerHTML = `<main class="empty-state"><h2>Could not start app</h2><p>${escapeHtml(error.message)}</p></main>`;
});
