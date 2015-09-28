(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports"], function (require, exports) {
    var RequestTimeoutError = (function () {
        function RequestTimeoutError(message) {
            this.message = message || 'The request timed out.';
        }
        Object.defineProperty(RequestTimeoutError.prototype, "name", {
            get: function () {
                return 'RequestTimeoutError';
            },
            enumerable: true,
            configurable: true
        });
        return RequestTimeoutError;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = RequestTimeoutError;
});
//# sourceMappingURL=../../_debug/request/errors/RequestTimeoutError.js.map