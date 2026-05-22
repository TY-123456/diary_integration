create web app (support mobile)

preset to dark mode (default, no other mode)

It should be able to import existing Evernote notes without changing the original creation time and the notes may include images. (need to use API to get the notes, user only need to click the button, all notes will import to the app. )

It should be able to import existing Google keep notes without changing the original creation time (also need modified time, tags, notebooks, attachments, and metadata preserved.)

It should have a function to add new notes, similar to the chat bar on the left of Codex, where notes can be categorized by folder (one note only belong to one folder)

The note function should include the following features:
(1) Adjusting font size and color
(2) Inserting photos
(3) Automatically recording creation time
(4) A title bar, body bar, and a bottom toolbar containing items (1) and (2) and other features you think are necessary.

Additional required changes:

1. Add a Trash button under the Folders list. Deleted notes should move to Trash first and be recoverable.
2. Mobile export sync file must work successfully.
3. The x button in the Move note dialog must work and return to the note list.
4. Change the right-side mobile + button text to + NOTE.
5. Add hide/unhide buttons like Microsoft Word's ribbon collapse control: one at the center edge of the note list window and one at the top middle of the tool list. The icon must reverse direction after hiding or unhiding.
6. Hidden tool list means Undo, Redo, Save, and Delete remain visible in the same row; only the other editor tools are hidden.
7. Tapping Undo or Redo should not open the mobile keyboard each time.
8. Change Undo and Redo icons to curved arrows similar to Microsoft Word, with Redo using the opposite direction.
9. On mobile, using browser Go Back should first return to the menu.
