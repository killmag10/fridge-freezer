var fs = require('fs');
var StructureOptions = require('./Structure/Options.js');
var EventEmitter = require('events');
var util = require('util');
require('es6-shim');

/**
 * Database strcuture versioning.
 *
 * @constructor
 * @param options   {Object}    the configuration object.
 */
var Structure = function(options) {
    var self = this;
    EventEmitter.call(self);
    if (!(options instanceof StructureOptions)) {
        throw new TypeError('Options no instance of StructureOptions!');
    }
    if (!options.adapter) {
        options.adapter = new (require('./Structure/Adapter/Sql'))(options);
    }
    if (!options.directory) {
        throw new TypeError('Directory not set!');
    }

    self.options = options;
    self.adapter = options.adapter;
};
util.inherits(Structure, EventEmitter);

Structure.prototype.getStructureChanges = function() {
    var self = this;

    var files = fs.readdirSync(self.options.directory);
    var changes = files.filter(
        function(file) {
            return /^[0-9]+\.forward\.sql$/.test(file);
        }
    ).map(
        function(file) {
            var versionName = file.match(/([0-9]+)\.forward\.sql$/)[1];
            var descriptionFile = versionName.concat('.description.txt');
            var descriptionPath = self.options.directory.concat(
                '/', descriptionFile
            );
            if (!fs.existsSync(descriptionPath)) {
                throw new Error('Description file not found!');
            }
            var forwardPath = self.options.directory.concat('/', file);
            var forwardSql = fs.readFileSync(forwardPath).toString();
            var description = fs.readFileSync(descriptionPath).toString().trim();
            if (!description) {
                throw new Error('Description file empty');
            }
            return {
                "version": Number(versionName),
                "description": description,
                "forwardSql": forwardSql,
                "path": self.options.directory.concat('/', file),
            };
        }
    ).filter(
        function(change) {
            return fs.statSync(change.path).isFile();
        }
    ).sort(
        function(a, b) {
            if (a.version > b.version) {
                return 1;
            }
            if (a.version < b.version) {
                return -1;
            }

            throw new Error(
                'Duplicate version found: ' + a.version.toString()
            );
        }
    );

    return changes;
};

Structure.prototype.migrate = function(version) {
    var self = this;

    self.options.logger && self.options.logger.info(
        '----- BEGIN DATABASE STRUCTURE MIGRATION -----'
    );

    var playVersion = function(change) {
        self.emit('beforeExecute', change);

        return self.adapter.setVersionDirty(
            change.version,
            self.options.user,
            change.description
        ).then(function() {
            return self.adapter.executeDatabaseChange(change.forwardSql);
        }).then(function() {
            return self.adapter.setVersionClean(change.version);
        });
    };

    return self.adapter.createChangelog().then(function() {
        return self.adapter.validate();
    }).then(function() {
        return self.getStructureChanges();
    }).then(function(changes) {
        return changes.reduce(function(p, change) {
            return p.then(function() {
                if (version !== undefined && version < change.version) {
                    // skip
                    return;
                }

                return self.adapter.isVersionPlayed(change.version)
                    .then(function(result) {
                        if (result) {
                            self.options.logger && self.options.logger.info(
                                'Version ' + change.version + ' already played.'
                            );
                            return;
                        }
                        self.options.logger && self.options.logger.info(
                            'Version ' + change.version + ' not played.'
                        );

                        return playVersion(change);
                    });
            });
        }, Promise.resolve()).then(function() {
            self.options.logger && self.options.logger.info(
                '----- FINISH DATABASE STRUCTURE MIGRATION -----'
            );
        });
    });
};

Structure.prototype.close = function() {
    this.options.adapter.close();
};

Structure.Options = StructureOptions;

module.exports = Structure;
