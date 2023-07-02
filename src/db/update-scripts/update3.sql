ALTER TABLE albums
RENAME TO collections;

ALTER TABLE album_tags
RENAME TO collection_tags;

ALTER TABLE collection_tags
RENAME COLUMN album_id TO collection_id;

ALTER TABLE files
RENAME COLUMN album_id TO collection_id;