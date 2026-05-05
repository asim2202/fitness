CREATE TABLE `bodyweight_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`waist_cm` real,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bodyweight_log_date_unique` ON `bodyweight_log` (`date`);--> statement-breakpoint
CREATE TABLE `photo_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`taken_at` text NOT NULL,
	`file_path` text NOT NULL,
	`angle` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`day_id` integer NOT NULL,
	`completed_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`day_id`) REFERENCES `workout_template_day`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_set` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_template_id` integer NOT NULL,
	`set_number` integer NOT NULL,
	`weight` real,
	`reps` integer,
	`felt_easy` integer DEFAULT false NOT NULL,
	`logged_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`client_id` text,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_template_id`) REFERENCES `workout_template_exercise`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_set_client_id_unique` ON `session_set` (`client_id`);--> statement-breakpoint
CREATE TABLE `workout_template_day` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_name` text NOT NULL,
	`title` text NOT NULL,
	`ordering` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_template_exercise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_id` integer NOT NULL,
	`ordering` integer NOT NULL,
	`name` text NOT NULL,
	`default_sets` integer NOT NULL,
	`rep_low` integer,
	`rep_high` integer,
	`rest_seconds` integer NOT NULL,
	`notes_md` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`day_id`) REFERENCES `workout_template_day`(`id`) ON UPDATE no action ON DELETE cascade
);
