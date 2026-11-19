ALTER TABLE "orgs" ADD COLUMN "country" text;--> statement-breakpoint
UPDATE "orgs" SET "country" = 'BE' WHERE "id" = (SELECT min("id") FROM "orgs");
