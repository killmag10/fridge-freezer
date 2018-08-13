var SlaveConnectionManager = org.pentaho.di.cluster.SlaveConnectionManager;

var getHttpClientVersion = function() {
    apacheHttpClient = SlaveConnectionManager.getInstance().createHttpClient();
    if (apacheHttpClient instanceof org.apache.http.impl.client.CloseableHttpClient) {
        return 4;
    }
    if (apacheHttpClient instanceof org.apache.commons.httpclient.HttpClient) {
        return 3;
    }

    return null;
};

var getHttpClient = function() {
    var version = getHttpClientVersion();
    if (version === 4) {
        return require('./Client/Version/Version4');
    }
    return require('./Client/Version/Version3');
};

module.exports = getHttpClient();
