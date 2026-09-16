ALTER TABLE `family_members` ADD `family_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `family_members` ADD `given_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_family_members_split_name` ON `family_members` (`family_name`,`given_name`);