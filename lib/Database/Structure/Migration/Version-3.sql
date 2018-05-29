ALTER TABLE `${tableName}`
CHANGE COLUMN `id` `id` VARCHAR(64) NOT NULL,
COMMENT = 'Holds the changes of the database structure.\nVersion: 3';
