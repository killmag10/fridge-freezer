var fs = require('fs');
var StructureOptions = require('./Structure/Options.js');
var EventEmitter = require('events');
var util = require('util');

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

    if (!options.directory) {
        throw new TypeError('Directory not set!');
    }
    var connection = null;
    if (typeof options.database !== 'string') {
        database = options.database;
    } else {
        var pentahoDatabase = org.pentaho.di.core.database.Database;
        databaseMeta = _step_.getTransMeta().findDatabase(options.database);
        if (null === databaseMeta) {
            throw new ReferenceError(
                'Database "' + options.database + '" not found!'
            );
        }
        var pentahoDatabase = new JavaDatabase(
            _step_.getTransMeta().findDatabase(options.database)
        );
        pentahoDatabase.connect();
        pentahoDatabase.setAutoCommit(false);
        database = pentahoDatabase.getConnection();

    }
    self.database = database;
    self.options = options;
    var createChangelogTable = function() {
        var sql = fs.readFileSync(options.changelogSqlFile);
        sql = sql.toString().split('${tableName}').join(options.changelogName);
        database.prepareStatement(sql).execute();
        database.commit();
    };

    var validateChangelog = function() {
        var sql =
            'SELECT id FROM `' + options.changelogName +
            '` WHERE appliedat IS NULL LIMIT 1';

        preparedStatement = database.prepareStatement(sql);

        var resultSet = preparedStatement.executeQuery();
        var buffer = resultSet.next();
        resultSet.close();
        if (buffer) {
            throw new Error('Database is in a inconsistent state.');
        };

        return true;
    };

    var getChangelogVersionStatus = function(id) {
        var sql =
            "SELECT id FROM " + options.changelogName +
            "  WHERE id = ?";

        preparedStatement = self.wrapStatement(sql)([id]);
        console.log(
            'get changelog Version'
        );

        var resultSet = preparedStatement.executeQuery();
        var buffer = resultSet.next();
        resultSet.close();
        return buffer;
    };

    var setVersionDirty = function(id, user, description) {
        var sql =
            "INSERT INTO `" + options.changelogName +
            "`(id, startedat, user, description) VALUES (?, ?, ?, ?)";
        options.logger && options.logger.info(
            'set versionDirty'
        );
        var preparedStatement = self.wrapStatement(sql)([id, new Date(), user, description]);
        preparedStatement.execute();
        database.commit();
        return false;
    };

    var setVersionClean = function(id) {
        var sql =
            "UPDATE `" + options.changelogName +
            "` SET appliedat = ? WHERE id = ?";
        options.logger && options.logger.info(
            'set versionClean'
        );
        var preparedStatement = self.wrapStatement(sql)([new Date(), id])
        preparedStatement.execute();
        database.commit();

        return false;
    };

    var getStructureChanges = function() {
        var files = fs.readdirSync(options.directory);
        var changes = files.filter(
            function(file) {
                return /^[0-9]+\.forward\.sql$/.test(file);
            }
        ).map(
            function(file) {
                var versionName = file.match(/([0-9]+)\.forward\.sql$/)[1];
                var descriptionFile = versionName.concat('.description.txt');
                var descriptionPath = options.directory.concat(
                    '/', descriptionFile
                );
                if (!fs.existsSync(descriptionPath)) {
                    throw new Error('Description file not found!');
                }
                var forwardPath = options.directory.concat('/', file);
                var forwardSql = fs.readFileSync(forwardPath).toString();
                var description = fs.readFileSync(descriptionPath).toString().trim();
                if (!description) {
                    throw new Error('Description file empty');
                }
                return {
                    "version": Number(versionName),
                    "description": description,
                    "forwardSql": forwardSql,
                    "path": options.directory.concat('/', file),
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

    this.migrate = function(version) {
        options.logger && options.logger.info(
            '----- BEGIN DATABASE STRUCTURE MIGRATION -----'
        );
        createChangelogTable();
        validateChangelog();

        var changes = getStructureChanges();
        changes.forEach(function(change) {
            if (version !== undefined && version < change.version) {
                // skip
                return;
            }

            if (getChangelogVersionStatus(change.version)) {
                options.logger && options.logger.info(
                    'Version ' + change.version + ' already played.'
                );
                return;
            }
            options.logger && options.logger.info(
                'Version ' + change.version + ' not played.'
            );

            options.logger && options.logger.info(
                'Playing SQL: ' + "\n" + change.forwardSql
            );
            setVersionDirty(
                change.version,
                options.user,
                change.description
            );
            self.emit('beforeExecute', change);
            change.forwardSql.split(/;\s*$/mg)
                .filter(item => item.trim().length > 0)
                .map(function(
                    query) {
                    database.prepareStatement(query).execute();
                });

            database.commit();
            setVersionClean(change.version);
        });
        options.logger && options.logger.info(
            '----- FINISH DATABASE STRUCTURE MIGRATION -----'
        );
    };

    this.close = function() {
        if (typeof options.database === 'string') {
            database.close();
        }
    };


};
util.inherits(Structure, EventEmitter);
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
