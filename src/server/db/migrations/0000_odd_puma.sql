CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS "collection_file" (
	"id" serial PRIMARY KEY NOT NULL,
	"collection_id" serial NOT NULL,
	"uploaded_by" serial NOT NULL,
	"name" "citext" NOT NULL,
	"mime_type" varchar(256) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"thumbnail_width" integer NOT NULL,
	"thumbnail_height" integer NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"duration_in_seconds" integer,
	"gps_latitude" integer,
	"gps_longitude" integer,
	"gps_altitude" integer,
	"gps_label" varchar(256),
	"blur_data_url" varchar,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "collection_file_collection_id_name_unique" UNIQUE("collection_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" serial NOT NULL,
	"name" "citext" NOT NULL,
	"description" varchar(256),
	"times_opened" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "collection_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" "citext" NOT NULL,
	"created_by" serial NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "tag_name_created_by_unique" UNIQUE("name","created_by")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tag_to_collection" (
	"tag_id" serial NOT NULL,
	"collection_id" serial NOT NULL,
	CONSTRAINT "tag_to_collection_tag_id_collection_id_pk" PRIMARY KEY("tag_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" "citext" NOT NULL,
	"hash" varchar NOT NULL,
	"salt" varchar NOT NULL,
	"require_sign_in" boolean DEFAULT false NOT NULL,
	"storage_used_kb" bigint DEFAULT '0'::bigint,
	"storage_allocation_kb" bigint,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_file" ADD CONSTRAINT "collection_file_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_file" ADD CONSTRAINT "collection_file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection" ADD CONSTRAINT "collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tag" ADD CONSTRAINT "tag_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_file_name_idx" ON "collection_file" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_name_idx" ON "collection" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tag_name_idx" ON "tag" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "username_idx" ON "user" USING btree ("username");