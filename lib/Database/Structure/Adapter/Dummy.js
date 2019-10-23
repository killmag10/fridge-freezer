require('es6-shim');
var fs = require('fs');
var util = require('util');

var Adapter = function(options) {
    this.options = options;
    this.changelog = null;
};

Adapter.prototype.createChangelog = function() {
    var self = this;

    return new Promise(function(resolve, reject) {
        self.changelog = {};

        resolve();
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
    var self = this;

    return new Promise(function(resolve, reject) {
        content.split(/;\s*$/mg)
            .filter(function(item) {
                return item.trim().length > 0;
            }).forEach(function(query) {
                self.options.logger && self.options.logger.log(
                    'Playing SQL:\n' + query
                );
            });

        resolve(true);
    });
};

Adapter.prototype.close = function() {
    this.options.logger && this.options.logger.log(
        'Changelog: ' + JSON.stringify(this.changelog, null, 4)
    );
};

module.exports = Adapter;
