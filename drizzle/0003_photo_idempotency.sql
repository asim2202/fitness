ALTER TABLE `photo_log` ADD COLUMN `client_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_log_client_id_unique` ON `photo_log` (`client_id`);
