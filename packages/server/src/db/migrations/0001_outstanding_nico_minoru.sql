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
CREATE TABLE "skill_specializations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "skill_specializations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"player_id" integer NOT NULL,
	"skill_id" varchar(32) NOT NULL,
	"level" smallint NOT NULL,
	"choice_id" varchar(64) NOT NULL,
	"chosen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "party_camps" ADD COLUMN "furniture" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "party_camps" ADD COLUMN "gardens" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "party_camps" ADD COLUMN "visitor_id" varchar(64);--> statement-breakpoint
ALTER TABLE "party_camps" ADD COLUMN "visitor_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "world_chunks" ADD COLUMN "landmarks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "player_pets" ADD CONSTRAINT "player_pets_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_specializations" ADD CONSTRAINT "skill_specializations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_pets_player_pet_idx" ON "player_pets" USING btree ("player_id","pet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_specs_player_skill_level_idx" ON "skill_specializations" USING btree ("player_id","skill_id","level");