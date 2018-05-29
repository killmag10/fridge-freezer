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
        options.adapter = new (require('./Structure/Adapter/Dummy'))(options);
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

/**
 * a tiny wrapper around jdbc preparedStatement because some databases handle this differently
 * @param  {String}  query - the parameterized query (with ?)
 * @return {Function}      - a function that takes the arguments (as a list) to the query to return a preparedStatement against which
 * execute() and executeQuery can be run
 */
Structure.prototype.wrapStatement = function(query) {
    var self = this;
    var properSQLCompliant = function(parameters) {
        var statement = self.database.prepareStatement(query);
        parameters.forEach(function(element, index) {
            var paramIndex = index + 1;
            switch (true) {

                case element === null:
                    preparedStatement.setNull(paramIndex, java.sql.Types.NULL);
                    break;
                case typeof element.valueOf() === 'string':
                    statement.setString(paramIndex, element);
                    break;
                case element instanceof Date:
                    statement.setDate(paramIndex, new java.sql.Date(element.getTime()));
                    break;
                default:
            }
        });
        return statement;
    };

    var nonCompliantSQL = function(parameters) {
        var splitQuery = query.split('?');
        if (splitQuery.length !== parameters.length + 1) {
            throw new RangeError('Parameter Count mismatches with Query: ' + query);
        }
        parameters = parameters.map(function(element) {
            switch (true) {
                case element === null:
                    return 'NULL';
                    break;
                case typeof element.valueOf() === 'string':
                    return '"' + element.split('"').join('\\"') + '"'
                    break;
                case element instanceof Date:
                    return element.getTime();
                    break;
                default:
                    return element;
            }
        });
        query = splitQuery.reduce(function(prev, cur, index) {
            return prev + parameters[index - 1] + cur;
        });
        return self.database.prepareStatement(query);
    };

    return self.options.noPreparedStatements ? nonCompliantSQL : properSQLCompliant;
};
Structure.Options = StructureOptions;

module.exports = Structure;
