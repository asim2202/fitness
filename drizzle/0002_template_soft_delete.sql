ALTER TABLE `workout_template_day` ADD COLUMN `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `workout_template_exercise` ADD COLUMN `deleted_at` text;
