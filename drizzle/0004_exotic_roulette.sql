ALTER TABLE "crawl_seeds" DROP CONSTRAINT "crawl_seeds_keyword_unique";--> statement-breakpoint
ALTER TABLE "crawl_seeds" ADD COLUMN "org_id" integer;--> statement-breakpoint
UPDATE "crawl_seeds" SET "org_id" = (SELECT min("id") FROM "orgs");--> statement-breakpoint
ALTER TABLE "crawl_seeds" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "crawl_seeds_org_keyword_uniq" ON "crawl_seeds" USING btree ("org_id","keyword");
