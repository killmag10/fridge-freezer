var fs = require('fs');
var util = require('util');
require('es6-shim');

var Adapter = function(options, database) {
    var self = this;

    this.options = options;
    this.database = database;
    this.changelog = null;
};

Adapter.prototype.createChangelog = function() {
    this.changelogReadCallback(function(err, data) {

    });
};

Adapter.prototype.validate = function() {
    var sql =
        'SELECT id FROM `' + options.changelogName +
        '` WHERE appliedat IS NULL LIMIT 1';

    var resultSet = database.prepareStatement(sql).executeQuery();
    var result = resultSet.next();
    resultSet.close();
    return result;
};

Adapter.prototype.isVersionPlayed = function(id) {
    var sql =
        "SELECT id FROM " + options.changelogName +
        "  WHERE id = ?";

    var preparedStatement = database.prepareStatement(sql);
    preparedStatement.setLong(1, id);
    var resultSet = preparedStatement.executeQuery();

    var result = resultSet.next();
    resultSet.close();
    return result;
};

Adapter.prototype.setVersionDirty = function(id, user, description) {
    var sql =
        "INSERT INTO `" + this.options.changelogName +
        "`(id, startedat, user, description) VALUES (?, ?, ?, ?)";

    var preparedStatement = this.database.prepareStatement(sql);;
    preparedStatement.setString(1, id);
    preparedStatement.setDate(2, new java.sql.Date(new Date().getTime()));
    if (null !== user) {
        preparedStatement.setString(3, user);
    } else {
        preparedStatement.setNull(3, java.sql.Types.NULL);
    }
    preparedStatement.setString(4, description);
    preparedStatement.execute();
    this.database.commit();
};

Adapter.prototype.setVersionClean = function(id) {
    var sql =
        "UPDATE `" + this.options.changelogName +
        "` SET appliedat = ? WHERE id = ?";

    var preparedStatement = this.database.prepareStatement(sql);
    preparedStatement.setDate(1, new java.sql.Date(new Date().getTime()));
    preparedStatement.setString(2, id);
    preparedStatement.execute();
    this.database.commit();
};

Adapter.prototype.executeDatabaseChange = function(content) {
    content.split(/;\s*$/mg)
        .filter(item => item.trim().length > 0)
        .map(function(
            query) {
            this.database.prepareStatement(query).execute();
        });

    this.database.commit();

    return true;
};

Adapter.prototype.changelogReadCallback = null;
Adapter.prototype.changelogWriteCallback = null;

Adapter.prototype.close = function() {};

module.exports = Adapter;
