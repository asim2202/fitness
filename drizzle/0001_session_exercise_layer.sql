CREATE TABLE `session_exercise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_template_id` integer NOT NULL,
	`ordering` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_template_id`) REFERENCES `workout_template_exercise`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_exercise_unique` ON `session_exercise` (`session_id`,`exercise_template_id`);
--> statement-breakpoint
INSERT INTO `session_exercise` (`session_id`, `exercise_template_id`, `ordering`, `created_at`)
SELECT s.session_id, s.exercise_template_id, e.ordering, COALESCE(MIN(s.logged_at), CURRENT_TIMESTAMP)
FROM `session_set` s
JOIN `workout_template_exercise` e ON e.id = s.exercise_template_id
GROUP BY s.session_id, s.exercise_template_id;
--> statement-breakpoint
CREATE TABLE `session_set__new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_exercise_id` integer NOT NULL,
	`set_number` integer NOT NULL,
	`weight` real,
	`reps` integer,
	`felt_easy` integer DEFAULT false NOT NULL,
	`logged_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`client_id` text,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `session_exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `session_set__new` (`id`, `session_exercise_id`, `set_number`, `weight`, `reps`, `felt_easy`, `logged_at`, `client_id`)
SELECT s.id, se.id, s.set_number, s.weight, s.reps, s.felt_easy, s.logged_at, s.client_id
FROM `session_set` s
JOIN `session_exercise` se
  ON se.session_id = s.session_id
  AND se.exercise_template_id = s.exercise_template_id;
--> statement-breakpoint
DROP TABLE `session_set`;
--> statement-breakpoint
ALTER TABLE `session_set__new` RENAME TO `session_set`;
--> statement-breakpoint
CREATE UNIQUE INDEX `session_set_client_id_unique` ON `session_set` (`client_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_set_unique` ON `session_set` (`session_exercise_id`,`set_number`);
