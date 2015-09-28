var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './async/Task', './has', './Registry', './load'], function (require, exports) {
    var Task_1 = require('./async/Task');
    var has_1 = require('./has');
    var Registry_1 = require('./Registry');
    var load_1 = require('./load');
    var FilterRegistry = (function (_super) {
        __extends(FilterRegistry, _super);
        function FilterRegistry() {
            _super.apply(this, arguments);
        }
        FilterRegistry.prototype.register = function (test, value, first) {
            var entryTest;
            if (typeof test === 'string') {
                entryTest = function (response, url, options) {
                    return test === url;
                };
            }
            else if (test instanceof RegExp) {
                entryTest = function (response, url, options) {
                    return test.test(url);
                };
            }
            else {
                entryTest = test;
            }
            return _super.prototype.register.call(this, entryTest, value, first);
        };
        return FilterRegistry;
    })(Registry_1.default);
    exports.FilterRegistry = FilterRegistry;
    var defaultProvider = './request/xhr';
    if (has_1.default('host-node')) {
        defaultProvider = './request/node';
    }
    var ProviderRegistry = (function (_super) {
        __extends(ProviderRegistry, _super);
        function ProviderRegistry() {
            var _this = this;
            _super.call(this);
            var deferRequest = function (url, options) {
                var canceled = false;
                var actualResponse;
                return new Task_1.default(function (resolve, reject) {
                    _this._providerPromise.then(function (provider) {
                        if (canceled) {
                            return;
                        }
                        actualResponse = provider(url, options);
                        actualResponse.then(resolve, reject);
                    });
                }, function () {
                    if (!canceled) {
                        canceled = true;
                    }
                    if (actualResponse) {
                        actualResponse.cancel();
                    }
                });
            };
            // The first request to hit the default value will kick off the import of the default
            // provider. While that import is in-flight, subsequent requests will queue up while
            // waiting for the provider to be fulfilled.
            this._defaultValue = function (url, options) {
                _this._providerPromise = load_1.default(require, defaultProvider).then(function (_a) {
                    var providerModule = _a[0];
                    _this._defaultValue = providerModule.default;
                    return providerModule.default;
                });
                _this._defaultValue = deferRequest;
                return deferRequest(url, options);
            };
        }
        ProviderRegistry.prototype.register = function (test, value, first) {
            var entryTest;
            if (typeof test === 'string') {
                entryTest = function (url, options) {
                    return test === url;
                };
            }
            else if (test instanceof RegExp) {
                entryTest = function (url, options) {
                    return test.test(url);
                };
            }
            else {
                entryTest = test;
            }
            return _super.prototype.register.call(this, entryTest, value, first);
        };
        return ProviderRegistry;
    })(Registry_1.default);
    exports.ProviderRegistry = ProviderRegistry;
    /**
     * Request filters, which filter or modify responses. The default filter simply passes a response through unchanged.
     */
    exports.filterRegistry = new FilterRegistry(function (response) {
        return response;
    });
    /**
     * Request providers, which fulfill requests.
     */
    exports.providerRegistry = new ProviderRegistry();
    /**
     * Make a request, returning a Promise that will resolve or reject when the request completes.
     */
    var request = function request(url, options) {
        if (options === void 0) { options = {}; }
        var promise = exports.providerRegistry.match(url, options)(url, options)
            .then(function (response) {
            return Task_1.default.resolve(exports.filterRegistry.match(response, url, options)(response, url, options))
                .then(function (filterResponse) {
                response.data = filterResponse.data;
                return response;
            });
        });
        return promise;
    };
    ['DELETE', 'GET', 'POST', 'PUT'].forEach(function (method) {
        request[method.toLowerCase()] = function (url, options) {
            if (options === void 0) { options = {}; }
            options = Object.create(options);
            options.method = method;
            return request(url, options);
        };
    });
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = request;
    /**
     * Add a filter that automatically parses incoming JSON responses.
     */
    exports.filterRegistry.register(function (response, url, options) {
        return typeof response.data === 'string' && options.responseType === 'json';
    }, function (response, url, options) {
        return {
            data: JSON.parse(response.data)
        };
    });
});
//# sourceMappingURL=_debug/request.js.map