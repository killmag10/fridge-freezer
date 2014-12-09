# fridge-freezer

## Http/Client
A http client to send requests.

### Properties

* *Params* [Http/Client/Params](Client/Params.md)

### Methods

#### request(params)

Do a request with the given params.

* *params* [Http/Client/Params](Client/Params.md) - A parameter object.

### Events

#### error
*function (error) { }*

Triggered if an error wars thrown. (For every retry)

* *error* Error - A error object.

#### adapterRequest
*function (client, method) { }*

Triggered before the request was send.

* *client* org.apache.commons.httpclient.HttpClient - The adapter client.
* *method* org.apache.commons.httpclient.HttpMethodBase - The adapter method.

#### adapterResponse
*function (client, method) { }*

Triggered after the request was send.

* *client* org.apache.commons.httpclient.HttpClient - The adapter client.
* *method* org.apache.commons.httpclient.HttpMethodBase - The adapter method.
