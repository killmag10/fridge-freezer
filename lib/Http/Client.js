var util = require('util');
var events = require('events');

var ApacheHttpClient = org.apache.commons.httpclient.HttpClient;

var ApacheMethodGet = org.apache.commons.httpclient.methods.GetMethod;
var ApacheMethodPost = org.apache.commons.httpclient.methods.PostMethod;
var ApacheMethodPut = org.apache.commons.httpclient.methods.PutMethod;

var ApacheUsernamePasswordCredentials = org.apache.commons.httpclient.UsernamePasswordCredentials
var ApacheAuthScope = org.apache.commons.httpclient.auth.AuthScope;

var ApacheParams = org.apache.commons.httpclient.params.HttpClientParams

var JavaBufferedReader = java.io.BufferedReader;
var JavaInputStreamReader = java.io.InputStreamReader;
var JavaString = java.lang.String;

var ClientBodyProcessor = require('./Client/Body/Processor.js');

var methods = {
    "get" : ApacheMethodGet,
    "post" : ApacheMethodPost,
    "put" : ApacheMethodPut
}

var Client = function()
{
    events.EventEmitter.call(this);
}
util.inherits(Client, events.EventEmitter);

Client.Params = require('./Client/Params.js');

var request = function(client, params)
{
    var apacheHttpClient = new ApacheHttpClient()

    if (methods[params.method] === undefined) {
        throw new Error('Http method not found: ' + params.method)
    }

    var method = new methods[params.method](params.url)

    // Header
    for (var key in params.header) {
        method.setRequestHeader(
            key,
            params.header[key]
        );
    }

    // Timeout
    if (params.timeout !== null) {
        apacheHttpClient.setTimeout(params.timeout);
        apacheHttpClient.setConnectionTimeout(params.timeout);
    }

    // Credentials
    if (params.credentials) {
        apacheHttpClient.getState().setCredentials(
            ApacheAuthScope.ANY,
            new ApacheUsernamePasswordCredentials(
                params.credentials.username,
                params.credentials.password
            )
        );
        apacheHttpClient.getParams().setAuthenticationPreemptive(true);
    }

    // Proxy
    if (params.proxy){
        apacheHttpClient.getHostConfiguration().setProxy(
            params.proxy.host,
            params.proxy.port
        );
    }

    // Generate body
    ClientBodyProcessor.process(
        method,
        params
    );

    // Request
    client.emit('adapterRequest', apacheHttpClient, method);
    var result = apacheHttpClient.executeMethod(method);
    client.emit('adapterResponse', apacheHttpClient, method);

    // Response
    var response = {};
    response.statusCode = Number(method.getStatusCode());
    response.body = '';

    method.getRequestHeaders().forEach(function(header) {
        response[String(header.getName())] = String(header.getValue());
    });

    var bodyStream = method.getResponseBodyAsStream();
    var bodyStreamReader = new JavaBufferedReader(
        new JavaInputStreamReader(
            bodyStream,
            params.encoding === null
                ? method.getRequestCharSet() : params.encoding
        )
    );

    var bodyLine;
    response.body = '';
    while ((bodyLine = bodyStreamReader.readLine()) !== null) {
        response.body += String(
            new JavaString(bodyLine.getBytes('UTF-8'))
        ) + "\n";
    }

    return response;
}

Client.prototype.request = function(params)
{
    var retries = params.retries;
    var errors = [];

    while(retries >= 0){
        retries--

        try {
            var result = request(this, params);
            result.errors = errors;
            return result;
        } catch (e){
            this.emit("error", e);

            errors.push(e);

            if (retries <= 0) {
                throw e;
            }

            if (!(
                e.javaException instanceof java.net.SocketTimeoutException
                || e.javaException instanceof java.net.ProtocolException
                || e.javaException instanceof java.net.UnknownHostException
                || e.javaException instanceof javax.net.ssl.SSLException
                || e.javaException instanceof org.apache.commons.httpclient.ProtocolException
                || e.javaException instanceof org.apache.commons.httpclient.ConnectTimeoutException
            )) {
                throw e;
            }
        }
    }
}

module.exports = Client;

