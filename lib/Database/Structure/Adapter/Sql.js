require('es6-shim');
var fs = require('fs');
var util = require('util');

var Adapter = function(options) {
    var self = this;

    var database = null;
    if (typeof options.database !== 'string') {
        database = options.database;
    } else {
        var PentahoDatabase = org.pentaho.di.core.database.Database;
        databaseMeta = _step_.getTransMeta().findDatabase(options.database);
        if (null === databaseMeta) {
            throw new ReferenceError(
                'Database "' + options.database + '" not found!'
            );
        }
        var pentahoDatabase = new PentahoDatabase(
            _step_.getTransMeta().findDatabase(options.database)
        );
        pentahoDatabase.connect();
        pentahoDatabase.setAutoCommit(false);
        database = pentahoDatabase.getConnection();
    }

    self.options = options;
    self.database = database;
};

Adapter.prototype.createChangelog = function() {
    var self = this;

    return new Promise(function(resolve, reject) {
        var sql = fs
            .readFileSync(self.options.changelogSqlFile)
            .toString()
            .split('${tableName}').join(self.options.changelogName);
        self.database.prepareStatement(sql).execute();
        self.database.commit();

        resolve();
    });
};

Adapter.prototype.validate = function() {
    var self = this;

    return new Promise(function(resolve, reject) {
        var sql =
            'SELECT id FROM `' + self.options.changelogName +
            '` WHERE appliedAt IS NULL LIMIT 1';

        var resultSet = self.database.prepareStatement(sql).executeQuery();
        var result = resultSet.next();
        resultSet.close();

        if (result) {
            throw new Error('Database is in a inconsistent state.');
        }

        resolve();
    });
};

Adapter.prototype.isVersionPlayed = function(id) {
    var self = this;

    return new Promise(function(resolve, reject) {
        var sql =
            "SELECT id FROM " + self.options.changelogName +
            "  WHERE id = ?";

        var preparedStatement = self.database.prepareStatement(sql);
        preparedStatement.setLong(1, id);
        var resultSet = preparedStatement.executeQuery();

        var result = resultSet.next();
        resultSet.close();

        resolve(result);
    });
};

Adapter.prototype.setVersionDirty = function(id, user, description) {
    var self = this;

    return new Promise(function(resolve, reject) {
        var sql =
            "INSERT INTO `" + self.options.changelogName +
            "`(id, startedAt, user, description) VALUES (?, ?, ?, ?)";

        var preparedStatement = self.database.prepareStatement(sql);;
        preparedStatement.setString(1, id);
        preparedStatement.setDate(2, new java.sql.Date(new Date().getTime()));
        if (null !== user) {
            preparedStatement.setString(3, user);
        } else {
            preparedStatement.setNull(3, java.sql.Types.NULL);
        }
        preparedStatement.setString(4, description);
        preparedStatement.execute();
        self.database.commit();

        resolve();
    });
};

Adapter.prototype.setVersionClean = function(id) {
    var self = this;

    return new Promise(function(resolve, reject) {
        var sql =
            "UPDATE `" + self.options.changelogName +
            "` SET appliedAt = ? WHERE id = ?";

        var preparedStatement = self.database.prepareStatement(sql);
        preparedStatement.setDate(1, new java.sql.Date(new Date().getTime()));
        preparedStatement.setString(2, id);
        preparedStatement.execute();
        self.database.commit();

        resolve();
    });
};

Adapter.prototype.executeDatabaseChange = function(content) {
    var self = this;

    return new Promise(function(resolve, reject) {
        content.split(/;\s*$/mg)
            .filter(function(item) {
                return item.trim().length > 0;
            }).map(function(query) {
                self.options.logger && self.options.logger.log(
                    'Playing SQL:\n' + query
                );
                self.database.prepareStatement(query).execute();
            });

        self.database.commit();

        resolve(true);
    });
};

Adapter.prototype.close = function() {
    if (typeof this.options.database === 'string') {
        this.database.close();
    }
};

module.exports = Adapter;
