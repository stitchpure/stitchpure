CREATE INDEX "categories_company_id_idx" ON "categories" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_company_id_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "products_company_id_idx" ON "products" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_items_product_id_idx" ON "product_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_ledger_item_company_idx" ON "stock_ledger" USING btree ("product_item_id","company_id");--> statement-breakpoint
CREATE INDEX "stock_ledger_company_id_idx" ON "stock_ledger" USING btree ("company_id");