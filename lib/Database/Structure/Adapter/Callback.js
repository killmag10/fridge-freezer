var fs = require('fs');
var util = require('util');
require('es6-shim');

var Adapter = function(options, database) {
    var self = this;

    self.options = options;
    self.database = options.database;
    this.changelog = null;
};

Adapter.prototype.createChangelog = function() {
    return new Promise(function(resolve, reject) {
        return this.changelogReadCallback(options, function(err, data) {
            if (err) {
                return reject(err);
            }

            resolve(data === null ? {} : data);
        });
    });
};

Adapter.prototype.validate = function() {
    var self = this;

    return new Promise(function(resolve, reject) {
        var result = Object.keys(self.changelog).map(function(key) {
            return self.changelog[key];
        }).some(function(item) {
            return item.appliedAt === null;
        });
        if (result) {
            throw new Error('Database is in a inconsistent state.');
        }

        resolve();
    });
};

Adapter.prototype.isVersionPlayed = function(id) {
    var self = this;

    return new Promise(function(resolve, reject) {
        resolve(self.changelog[id] !== undefined);
    });
};

Adapter.prototype.setVersionDirty = function(id, user, description) {
    var self = this;

    return new Promise(function(resolve, reject) {
        self.changelog[id] = {
            id: id,
            user: user,
            description: description,
            appliedAt: null
        };

        resolve();
    });
};

Adapter.prototype.setVersionClean = function(id) {
    var self = this;

    return new Promise(function(resolve, reject) {
        self.changelog[id].appliedAt = new Date();
        resolve();
    });
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

Adapter.prototype.close = function() {
    return new Promise(function(resolve, reject) {
        return this.changelogWriteCallback(options, function(err, data) {
            if (err) {
                return reject(err);
            }

            resolve(data === null ? {} : data);
        });
    });
};

module.exports = Adapter;
