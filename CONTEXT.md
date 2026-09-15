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
- A **Backup job** produces at most one **Backup** for one **User**
- A **Backup** contains exactly one **Manifest** and one metadata document per **Collection**
- A **User** has at most one queued or running **Backup job** at a time
- At most one **Backup job** runs at a time across the whole instance
- A **User** has at most one **Current backup**
- A **Backup** captures the user's data as it was when its **Backup job** started

## Flagged ambiguities

- "export" and "backup" were both used for this feature — resolved: it is a **Backup**, since it is intended to be restorable in future.
