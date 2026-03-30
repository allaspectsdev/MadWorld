CREATE TABLE "equipment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "equipment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"slot" varchar(16) NOT NULL,
	"item_id" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"slot_index" smallint NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_camps" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "party_camps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"party_id" varchar(64) NOT NULL,
	"owner_player_id" integer NOT NULL,
	"name" varchar(32) DEFAULT 'Camp' NOT NULL,
	"world_x" real NOT NULL,
	"world_y" real NOT NULL,
	"chunk_x" integer NOT NULL,
	"chunk_y" integer NOT NULL,
	"tier" smallint DEFAULT 1 NOT NULL,
	"storage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"furniture" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gardens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visitor_id" varchar(64),
	"visitor_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_discovery" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_discovery_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"chunk_x" integer NOT NULL,
	"chunk_y" integer NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_pets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_pets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"pet_id" varchar(32) NOT NULL,
	"name" varchar(24) NOT NULL,
	"bond_xp" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"tamed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" varchar(24) NOT NULL,
	"zone_id" varchar(64) DEFAULT 'greendale' NOT NULL,
	"pos_x" real DEFAULT 10 NOT NULL,
	"pos_y" real DEFAULT 10 NOT NULL,
	"current_hp" integer DEFAULT 100 NOT NULL,
	"max_hp" integer DEFAULT 100 NOT NULL,
	"appearance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "quest_progress" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quest_progress_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"quest_id" varchar(64) NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "skill_specializations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skill_specializations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"skill_id" varchar(32) NOT NULL,
	"level" smallint NOT NULL,
	"choice_id" varchar(64) NOT NULL,
	"chosen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"skill_id" varchar(32) NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(32) NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"is_god" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_display_name_unique" UNIQUE("display_name")
);
--> statement-breakpoint
CREATE TABLE "world_chunks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "world_chunks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"world_seed" integer NOT NULL,
	"chunk_x" integer NOT NULL,
	"chunk_y" integer NOT NULL,
	"biome" varchar(32) NOT NULL,
	"tile_data" jsonb NOT NULL,
	"mob_spawns" jsonb NOT NULL,
	"lights" jsonb NOT NULL,
	"landmarks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_camps" ADD CONSTRAINT "party_camps_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_discovery" ADD CONSTRAINT "player_discovery_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_pets" ADD CONSTRAINT "player_pets_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_specializations" ADD CONSTRAINT "skill_specializations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_player_slot_idx" ON "equipment" USING btree ("player_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_player_slot_idx" ON "inventory" USING btree ("player_id","slot_index");--> statement-breakpoint
CREATE UNIQUE INDEX "party_camps_party_idx" ON "party_camps" USING btree ("party_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_discovery_player_chunk_idx" ON "player_discovery" USING btree ("player_id","chunk_x","chunk_y");--> statement-breakpoint
CREATE UNIQUE INDEX "player_pets_player_pet_idx" ON "player_pets" USING btree ("player_id","pet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_specs_player_skill_level_idx" ON "skill_specializations" USING btree ("player_id","skill_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_player_skill_idx" ON "skills" USING btree ("player_id","skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "world_chunks_seed_pos_idx" ON "world_chunks" USING btree ("world_seed","chunk_x","chunk_y");