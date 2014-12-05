var Params = function(){};
Params.Credentials = require('./Params/Credentials.js');
Params.Proxy = require('./Params/Proxy.js');

Params.prototype.url = null;
Params.prototype.timeout = null;
Params.prototype.method = 'get';
Params.prototype.header = {};
Params.prototype.body = null;
Params.prototype.encoding = 'UTF-8';
Params.prototype.retrys = 0;

Params.prototype.credentials = null;
Params.prototype.proxy = null;

module.exports = Params;

