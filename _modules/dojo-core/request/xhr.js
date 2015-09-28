(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../async/Task', './errors/RequestTimeoutError', '../global', '../has', './util'], function (require, exports) {
    var Task_1 = require('../async/Task');
    var RequestTimeoutError_1 = require('./errors/RequestTimeoutError');
    var global_1 = require('../global');
    var has_1 = require('../has');
    var util_1 = require('./util');
    /**
     * A lookup table for valid `XMLHttpRequest#responseType` values.
     *
     * 'json' deliberately excluded since it is not supported in all environments, and as there is
     * already a filter for it in '../request'. Default '' and 'text' values also deliberately excluded.
     */
    var responseTypeMap = {
        arraybuffer: 'arraybuffer',
        // XHR2 environments that do not support `responseType=blob` still support `responseType=arraybuffer`,
        // which is a better way of handling blob data than as a string representation.
        blob: has_1.default('xhr2-blob') ? 'blob' : 'arraybuffer',
        document: 'document'
    };
    function xhr(url, options) {
        if (options === void 0) { options = {}; }
        var request = new XMLHttpRequest();
        var requestUrl = util_1.generateRequestUrl(url, options);
        var response = {
            data: null,
            nativeResponse: request,
            requestOptions: options,
            statusCode: null,
            statusText: null,
            url: requestUrl,
            getHeader: function (name) {
                return request.getResponseHeader(name);
            }
        };
        var promise = new Task_1.default(function (resolve, reject) {
            if (!options.method) {
                options.method = 'GET';
            }
            if ((!options.user || !options.password) && options.auth) {
                var auth = options.auth.split(':');
                options.user = decodeURIComponent(auth[0]);
                options.password = decodeURIComponent(auth[1]);
            }
            request.open(options.method, requestUrl, !options.blockMainThread, options.user, options.password);
            if (has_1.default('xhr2') && options.responseType in responseTypeMap) {
                request.responseType = responseTypeMap[options.responseType];
            }
            request.onreadystatechange = function () {
                if (request.readyState === 4) {
                    request.onreadystatechange = function () { };
                    if (options.responseType === 'xml') {
                        response.data = request.responseXML;
                    }
                    else {
                        response.data = ('response' in request) ? request.response : request.responseText;
                    }
                    response.statusCode = request.status;
                    response.statusText = request.statusText;
                    if (response.statusCode >= 200 && response.statusCode < 400) {
                        resolve(response);
                    }
                    else {
                        reject(response.statusText ?
                            new Error(response.statusText) :
                            new Error('An error prevented completion of the request.'));
                    }
                }
            };
            if (options.timeout > 0 && options.timeout !== Infinity) {
                request.timeout = options.timeout;
                request.ontimeout = function () {
                    reject(new RequestTimeoutError_1.default('The XMLHttpRequest request timed out.'));
                };
            }
            var headers = options.headers;
            var hasContentTypeHeader = false;
            for (var header in headers) {
                if (header.toLowerCase() === 'content-type') {
                    hasContentTypeHeader = true;
                }
                request.setRequestHeader(header, headers[header]);
            }
            if (!headers || !('X-Requested-With' in headers)) {
                request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            }
            if (!hasContentTypeHeader && has_1.default('formdata') && options.data instanceof global_1.default.FormData) {
                // Assume that most forms do not contain large binary files. If that is not the case,
                // then "multipart/form-data" should be manually specified as the "Content-Type" header.
                request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            }
            if (options.responseType === 'xml' && request.overrideMimeType) {
                // This forces the XHR to parse the response as XML regardless of the MIME-type returned by the server
                request.overrideMimeType('text/xml');
            }
            request.send(options.data);
        }, function () {
            request && request.abort();
        });
        return promise;
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = xhr;
});
//# sourceMappingURL=../_debug/request/xhr.js.map