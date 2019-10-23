CREATE TABLE IF NOT EXISTS `${tableName}` (
  `id` VARCHAR(64) NOT NULL,
  `startedAt` datetime NOT NULL,
  `appliedAt` datetime NULL DEFAULT NULL,
  `user` VARCHAR(63) NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`id`)
)
DEFAULT CHARSET=utf8
COMMENT='Holds the changes of the database structure.\nVersion: 3';
