CREATE TABLE "calorie_days" (
	"day" date PRIMARY KEY NOT NULL,
	"kcal" numeric(7, 1) NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
