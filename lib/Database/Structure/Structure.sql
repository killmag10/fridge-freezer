CREATE TABLE `changelog` (
  `id` INT(11) UNSIGNED NOT NULL,
  `startedAt` timestamp NOT NULL,
  `appliedAt` timestamp NULL DEFAULT NULL,
  `user` VARCHAR(63) NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`id`)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8
COMMENT='Holds the changes of the database structure';
