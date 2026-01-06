CREATE TABLE `tournaments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`lat` real NOT NULL,
	`long` real NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`has_golf` integer,
	`has_accuracy` integer,
	`has_distance` integer,
	`has_scf` integer,
	`has_discathon` integer,
	`has_ddc` integer,
	`has_freestyle` integer,
	`created_at` integer NOT NULL,
	`changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournaments_name_unique` ON `tournaments` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournaments_slug_unique` ON `tournaments` (`slug`);--> statement-breakpoint
CREATE TABLE `tournamentvenues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`venue_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`changed_at` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`facilities` text,
	`lat` real NOT NULL,
	`long` real NOT NULL,
	`created_at` integer NOT NULL,
	`changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venues_name_unique` ON `venues` (`name`);