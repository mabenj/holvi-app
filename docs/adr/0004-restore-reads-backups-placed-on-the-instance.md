# A Restore reads a Backup the operator placed on the instance, never one uploaded through the app

A Backup can be tens of gigabytes, more than the upload path accepts and more than a browser upload handles reliably. So a Restore reads a Backup zip that is already on the instance. The operator copies it, with rsync, scp or a USB drive, into the user's own folder, named by username, inside a restore directory set in Instance configuration. The user's Current backup is offered as well while its zip still exists. Holvi only reads from the restore directory and never writes, moves or deletes anything in it, so it can be mounted read-only. A user is only ever offered the zips in their own folder.

## Considered Options

- **A chunked, resumable upload through the browser**: a new upload path to build and secure, a staging copy as large as the Backup on the data volume, and still slower and less sturdy than rsync or scp for tens of gigabytes.
- **Unpacking the zip in the browser and uploading files one by one**: the existing upload re-reads metadata from each file, so collections, tags, Covers and dates would be lost or need a second metadata channel, and the browser would hold the whole job for hours.

## Consequences

- Someone with access to the instance has to place the zip, unless the user's Current backup is still there.
- No extra disk is needed for a staging copy, and no new upload path is exposed.
- The folder name is the username exactly, and usernames contain only letters, digits and underscores, so a user's folder can never point outside the restore directory.
