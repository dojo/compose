(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../async/Task', './errors/RequestTimeoutError', 'http', 'https', '../lang', '../streams/adapters/ReadableNodeStreamSource', '../streams/adapters/WritableNodeStreamSink', '../streams/ReadableStream', '../streams/WritableStream', 'url', './util'], function (require, exports) {
    var Task_1 = require('../async/Task');
    var RequestTimeoutError_1 = require('./errors/RequestTimeoutError');
    var http = require('http');
    var https = require('https');
    var lang_1 = require('../lang');
    var ReadableNodeStreamSource_1 = require('../streams/adapters/ReadableNodeStreamSource');
    var WritableNodeStreamSink_1 = require('../streams/adapters/WritableNodeStreamSink');
    var ReadableStream_1 = require('../streams/ReadableStream');
    var WritableStream_1 = require('../streams/WritableStream');
    var urlUtil = require('url');
    var util_1 = require('./util');
    // TODO: Where should the dojo version come from? It used to be kernel, but we don't have that.
    var version = '2.0.0-pre';
    function normalizeHeaders(headers) {
        var normalizedHeaders = {};
        for (var key in headers) {
            normalizedHeaders[key.toLowerCase()] = headers[key];
        }
        return normalizedHeaders;
    }
    function node(url, options) {
        if (options === void 0) { options = {}; }
        var requestUrl = util_1.generateRequestUrl(url, options);
        var parsedUrl = urlUtil.parse(options.proxy || requestUrl);
        var requestOptions = {
            agent: options.agent,
            auth: parsedUrl.auth || options.auth,
            ca: options.ca,
            cert: options.cert,
            ciphers: options.ciphers,
            headers: normalizeHeaders(options.headers || {}),
            host: parsedUrl.host,
            hostname: parsedUrl.hostname,
            key: options.key,
            localAddress: options.localAddress,
            method: options.method ? options.method.toUpperCase() : 'GET',
            passphrase: options.passphrase,
            path: parsedUrl.path,
            pfx: options.pfx,
            port: Number(parsedUrl.port),
            rejectUnauthorized: options.rejectUnauthorized,
            secureProtocol: options.secureProtocol,
            socketPath: options.socketPath
        };
        if (!('user-agent' in requestOptions.headers)) {
            requestOptions.headers['user-agent'] = 'dojo/' + version + ' Node.js/' + process.version.replace(/^v/, '');
        }
        if (options.proxy) {
            requestOptions.path = requestUrl;
            if (parsedUrl.auth) {
                requestOptions.headers['proxy-authorization'] = 'Basic ' + new Buffer(parsedUrl.auth).toString('base64');
            }
            var _parsedUrl = urlUtil.parse(requestUrl);
            requestOptions.headers['host'] = _parsedUrl.host;
            requestOptions.auth = _parsedUrl.auth || options.auth;
        }
        if (!options.auth && (options.user || options.password)) {
            requestOptions.auth = encodeURIComponent(options.user || '') + ':' + encodeURIComponent(options.password || '');
        }
        var request = (parsedUrl.protocol === 'https:' ? https : http).request(requestOptions);
        var response = {
            data: null,
            getHeader: function (name) {
                return (this.nativeResponse && this.nativeResponse.headers[name.toLowerCase()]) || null;
            },
            requestOptions: options,
            statusCode: null,
            url: requestUrl
        };
        var promise = new Task_1.default(function (resolve, reject) {
            if (options.socketOptions) {
                if ('timeout' in options.socketOptions) {
                    request.setTimeout(options.socketOptions.timeout);
                }
                if ('noDelay' in options.socketOptions) {
                    request.setNoDelay(options.socketOptions.noDelay);
                }
                if ('keepAlive' in options.socketOptions) {
                    var initialDelay = options.socketOptions.keepAlive;
                    request.setSocketKeepAlive(initialDelay >= 0, initialDelay);
                }
            }
            var timeout;
            request.once('response', function (nativeResponse) {
                response.nativeResponse = nativeResponse;
                response.statusCode = nativeResponse.statusCode;
                // Redirection handling defaults to true in order to harmonise with the XHR provider, which will always
                // follow redirects
                // TODO: This redirect code is not 100% correct according to the RFC; needs to handle redirect loops and
                // restrict/modify certain redirects
                if (response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.statusCode !== 304 &&
                    options.followRedirects !== false &&
                    nativeResponse.headers.location) {
                    resolve(node(nativeResponse.headers.location, options));
                    return;
                }
                options.streamEncoding && nativeResponse.setEncoding(options.streamEncoding);
                if (options.streamTarget) {
                    var responseSource = new ReadableNodeStreamSource_1.default(nativeResponse);
                    var responseReadableStream = new ReadableStream_1.default(responseSource);
                    responseReadableStream.pipeTo(options.streamTarget)
                        .then(function () {
                        resolve(response);
                    }, function (error) {
                        options.streamTarget.abort(error);
                        request.abort();
                        error.response = response;
                        reject(error);
                    });
                }
                var data;
                var loaded;
                if (!options.streamData) {
                    data = [];
                    loaded = 0;
                    nativeResponse.on('data', function (chunk) {
                        data.push(chunk);
                        loaded += (typeof chunk === 'string') ?
                            Buffer.byteLength(chunk, options.streamEncoding) :
                            chunk.length;
                    });
                }
                nativeResponse.once('end', function () {
                    timeout && timeout.destroy();
                    if (!options.streamData) {
                        // TODO: what type should data have?
                        response.data = (options.streamEncoding ? data.join('') : Buffer.concat(data, loaded));
                    }
                    // If using a streamTarget, wait for it to finish in case it throws an error
                    if (!options.streamTarget) {
                        resolve(response);
                    }
                    else {
                        options.streamTarget.close();
                    }
                });
            });
            request.once('error', reject);
            if (options.data) {
                if (options.data instanceof ReadableStream_1.default) {
                    var requestSink = new WritableNodeStreamSink_1.default(request);
                    var writableRequest = new WritableStream_1.default(requestSink);
                    options.data.pipeTo(writableRequest)
                        .catch(function (error) {
                        error.response = response;
                        writableRequest.abort(error);
                        reject(error);
                    });
                }
                else {
                    request.end();
                }
            }
            else {
                request.end();
            }
            if (options.timeout > 0 && options.timeout !== Infinity) {
                timeout = (function () {
                    var timer = setTimeout(function () {
                        var error = new RequestTimeoutError_1.default('Request timed out after ' + options.timeout + 'ms');
                        error.response = response;
                        reject(error);
                    }, options.timeout);
                    return lang_1.createHandle(function () {
                        clearTimeout(timer);
                    });
                })();
            }
        }, function () {
            request.abort();
        }).catch(function (error) {
            var parsedUrl = urlUtil.parse(url);
            if (parsedUrl.auth) {
                parsedUrl.auth = '(redacted)';
            }
            var sanitizedUrl = urlUtil.format(parsedUrl);
            error.message = '[' + requestOptions.method + ' ' + sanitizedUrl + '] ' + error.message;
            throw error;
        });
        return promise;
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = node;
});
//# sourceMappingURL=../_debug/request/node.js.map