CREATE TABLE "bp_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"systolic" integer NOT NULL,
	"diastolic" integer NOT NULL,
	"pulse" integer,
	"category" text,
	"source" text NOT NULL,
	"gmail_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"readings_found" integer NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"weight_kg" numeric(6, 2) NOT NULL,
	"height_cm" numeric(5, 1),
	"bmi" numeric(4, 1),
	"category" text,
	"source" text NOT NULL,
	"gmail_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bp_readings_measured_at_idx" ON "bp_readings" USING btree ("measured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "weight_readings_measured_at_idx" ON "weight_readings" USING btree ("measured_at");