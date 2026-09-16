CREATE TABLE `calendar_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`event_date` text NOT NULL,
	`event_time` text,
	`location` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_events_date` ON `calendar_events` (`event_date`);--> statement-breakpoint
CREATE INDEX `idx_calendar_events_recurrence` ON `calendar_events` (`recurrence`);--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`birth_year` integer,
	`birth_month` integer,
	`birth_day` integer,
	`death_year` integer,
	`death_month` integer,
	`death_day` integer,
	`memo` text DEFAULT '' NOT NULL,
	`photo_key` text,
	`photo_name` text,
	`photo_content_type` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_family_members_name` ON `family_members` (`name`);--> statement-breakpoint
CREATE TABLE `family_relationships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`related_person_id` integer NOT NULL,
	`relationship_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_family_relationships_person` ON `family_relationships` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_family_relationships_related` ON `family_relationships` (`related_person_id`);--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`date_year` integer NOT NULL,
	`date_month` integer,
	`date_day` integer,
	`date_precision` text NOT NULL,
	`category` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_photo_key` text,
	`cover_photo_name` text,
	`cover_photo_content_type` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_timeline_events_date` ON `timeline_events` (`date_year`,`date_month`,`date_day`);