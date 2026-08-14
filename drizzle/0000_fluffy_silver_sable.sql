CREATE TABLE `game_saves` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`slot` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`schema_version` integer NOT NULL,
	`state_json` text NOT NULL,
	`checksum` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_saves_player_slot_uidx` ON `game_saves` (`player_id`,`slot`);--> statement-breakpoint
CREATE INDEX `game_saves_updated_at_idx` ON `game_saves` (`updated_at`);--> statement-breakpoint
CREATE TABLE `leaderboard` (
	`player_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`power` integer NOT NULL,
	`stage` integer NOT NULL,
	`level` integer NOT NULL,
	`realm` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `leaderboard_power_idx` ON `leaderboard` (`power`);--> statement-breakpoint
CREATE INDEX `leaderboard_stage_idx` ON `leaderboard` (`stage`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `players_updated_at_idx` ON `players` (`updated_at`);--> statement-breakpoint
CREATE TABLE `save_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`revision` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`reason` text NOT NULL,
	`state_json` text NOT NULL,
	`checksum` text NOT NULL,
	`stage` integer NOT NULL,
	`level` integer NOT NULL,
	`power` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `save_snapshots_player_created_idx` ON `save_snapshots` (`player_id`,`created_at`);