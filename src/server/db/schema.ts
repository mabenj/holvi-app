import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  pgTableCreator,
  primaryKey,
  serial,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const createTable = pgTableCreator((name) => name);

export const users = createTable(
  "user",
  {
    id: serial("id").primaryKey(),
    username: citext("username", { length: 256 }).unique().notNull(),
    hash: varchar("hash").notNull(),
    salt: varchar("salt").notNull(),
    requireSignIn: boolean("require_sign_in").default(false).notNull(),
    storageUsedKb: bigint("storage_used_kb", { mode: "bigint" }).default(
      sql`'0'::bigint`,
    ),
    storageAllocationKb: bigint("storage_allocation_kb", {
      mode: "bigint",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (user) => ({
    usernameIdx: index("username_idx").on(user.username),
  }),
);

export const collections = createTable(
  "collection",
  {
    id: serial("id").primaryKey(),
    userId: serial("user_id").references(() => users.id),
    name: citext("name", { length: 256 }).notNull(),
    description: varchar("description", { length: 256 }),
    timesOpened: integer("times_opened").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (collection) => ({
    unq: unique().on(collection.userId, collection.name),
    nameIndex: index("collection_name_idx").on(collection.name),
  }),
);

export const collectionFiles = createTable(
  "collection_file",
  {
    id: serial("id").primaryKey(),
    collectionId: serial("collection_id").references(() => collections.id),
    uploaderId: serial("uploaded_by").references(() => users.id),
    name: citext("name", { length: 256 }).notNull(),
    mimeType: varchar("mime_type", { length: 256 }).notNull().notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    thumbnailWidth: integer("thumbnail_width").notNull(),
    thumbnailHeight: integer("thumbnail_height").notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    durationInSeconds: integer("duration_in_seconds"),
    gpsLatitude: integer("gps_latitude"),
    gpsLongitude: integer("gps_longitude"),
    gpsAltitude: integer("gps_altitude"),
    gpsLabel: varchar("gps_label", { length: 256 }),
    blurDataUrl: varchar("blur_data_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (collectionFile) => ({
    unq: unique().on(collectionFile.collectionId, collectionFile.name),
    nameIndex: index("collection_file_name_idx").on(collectionFile.name),
  }),
);

export const tags = createTable(
  "tag",
  {
    id: serial("id").primaryKey(),
    name: citext("name", { length: 256 }).notNull(),
    createdById: serial("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (tag) => ({
    nameIndex: index("tag_name_idx").on(tag.name),
    unq: unique().on(tag.name, tag.createdById),
  }),
);

export const tagsToCollections = createTable(
  "tag_to_collection",
  {
    tagId: serial("tag_id"),
    collectionId: serial("collection_id"),
  },
  (tagToCollection) => ({
    pk: primaryKey({
      columns: [tagToCollection.tagId, tagToCollection.collectionId],
    }),
  }),
);
