# Holvi

Holvi is a self-hosted vault for a user's photos and videos, stored encrypted at rest and organised into collections.

## Language

### Content

**User**:
A person with an account. Owns collections and everything in them.

**Collection**:
A named group of files owned by one user, with an optional description and tags.

**File**:
A single image or video inside a collection, together with its metadata (dimensions, when it was taken, GPS location, duration, tags).
_Avoid_: item, media, asset

**Tag**:
A case-insensitive label that can be attached to collections and to files.

**Cover**:
The file that represents a collection on its card and page. Chosen by the user, or otherwise the collection's first file by name.
_Avoid_: thumbnail (every file has a thumbnail; the Cover is a file)

**Timeline**:
Every file a user owns, across all their collections, newest first.
_Avoid_: all media, camera roll

### Browsing

**Open**:
One visit by a user to a collection's page. A visit less than 30 minutes after the previous visit to the same collection extends that Open instead of counting again. Viewing files does not make an Open.
_Avoid_: view

**Open count**:
The number of Opens a collection has had.

**Last opened**:
When a collection was last visited, or none if it has never been opened.

**Last added to**:
When a file was most recently added to a collection, or when the collection was created if it has no files. Not the same as the collection's own creation time.
_Avoid_: newest, last updated

**Forgotten collection**:
A collection whose Last opened, or its creation time if it has never been opened, is more than a year ago.

**Shuffle period**:
The length of time for which the random order of a user's collections stays the same before it changes on its own.

### Video

**Rendition**:
A web-playable copy of a video, derived from its original, which it never replaces or modifies.
_Avoid_: transcode, converted file

**Scrub preview**:
A grid of small frames sampled from a video, used to preview positions while scrubbing through it.
_Avoid_: sprite, storyboard

### Backup

**Backup**:
A single zip archive containing all of one user's files in decrypted form plus all their metadata, produced so the user holds a complete copy of their data outside Holvi. Designed so it could be restored later, although restore does not exist yet.
_Avoid_: export

**Backup job**:
One run of producing a backup. Waits as queued until no other backup job is running on the instance, then runs in the background, reports progress, and ends as completed, completed with errors, failed, or cancelled. Only completed jobs (with or without errors) leave a backup behind.

**Manifest**:
The top-level metadata document inside a backup: the format version, the user, the list of collections it contains, the outcome of the backup job, and any problem files. Each collection's own metadata (the collection, its files and their tags) lives in a separate document per collection that the manifest points to.

**Backup path**:
The readable location of a file inside a backup, derived from the collection name and file name but made safe and unique. Never assumed to equal the original names; the originals are kept in the metadata.

**Skipped file**:
A file that could not be included in a backup (missing, unreadable, or deleted during the backup job). Recorded in the manifest; does not fail the backup job.

**Damaged file**:
A file whose content failed partway through being written into a backup, so the backup holds an incomplete copy of it. Recorded in the manifest and its collection's metadata; does not fail the backup job.
_Avoid_: corrupt file (ambiguous with damage in the encrypted original)

**Problem file**:
A Skipped file or a Damaged file. A backup job with any problem files ends as completed with errors, and lists them for the user.

**Current backup**:
The most recent completed backup for a user. It is the only one kept; it replaces the previous one when it completes.

## Relationships

- A **User** owns zero or more **Collections**
- A **Collection** contains zero or more **Files**
- **Tags** attach to **Collections** and to **Files** independently
- A **Collection** with files has exactly one **Cover**, one of its own **Files**
- A **Collection's** **Open count** and **Last opened** summarise its **Opens**; each **Collection** has one owner, so Opens measure that **User's** own habits
- A video **File** has at most one **Rendition** and at most one **Scrub preview**
- A **Backup job** produces at most one **Backup** for one **User**
- A **Backup** contains exactly one **Manifest** and one metadata document per **Collection**
- A **User** has at most one queued or running **Backup job** at a time
- At most one **Backup job** runs at a time across the whole instance
- A **User** has at most one **Current backup**
- A **Backup** captures the user's data as it was when its **Backup job** started
- A **Backup** contains original **Files** only, never **Renditions** or **Scrub previews**

## Flagged ambiguities

- "export" and "backup" were both used for this feature — resolved: it is a **Backup**, since it is intended to be restorable in future.
- "All media" was the working name for the view of every file — resolved: it is the **Timeline**, since this glossary avoids "media" for File.
- "Newest" collections meant the collection's own creation time — resolved: collections are ordered by **Last added to**, which falls back to creation time only for empty collections.
