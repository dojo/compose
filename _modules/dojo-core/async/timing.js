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
})(["require", "exports", '../Promise'], function (require, exports) {
    var Promise_1 = require('../Promise');
    /**
     * Used for delaying a Promise chain for a specific number of milliseconds.
     *
     * @param milliseconds the number of milliseconds to delay
     * @return {function(T): Promise<T>} a function producing a promise that eventually returns the value passed to it; usable with Thenable.then()
     */
    function delay(milliseconds) {
        return function (value) {
            return new Promise_1.default(function (resolve) {
                setTimeout(function () {
                    resolve(value);
                }, milliseconds);
            });
        };
    }
    exports.delay = delay;
    /**
     * Reject a promise chain if a result hasn't been found before the timeout
     *
     * @param milliseconds after this number of milliseconds a rejection will be returned
     * @param reason The reason for the rejection
     * @return {function(T): Promise<T>} a function that produces a promise that is rejected or resolved based on your timeout
     */
    function timeout(milliseconds, reason) {
        var start = Date.now();
        return function (value) {
            if (Date.now() - milliseconds > start) {
                return Promise_1.default.reject(reason);
            }
            return Promise_1.default.resolve(value);
        };
    }
    exports.timeout = timeout;
    /**
     * A Promise that will reject itself automatically after a time.
     * Useful for combining with other promises in Promise.race.
     */
    var DelayedRejection = (function (_super) {
        __extends(DelayedRejection, _super);
        /**
         * @param milliseconds the number of milliseconds to wait before triggering a rejection
         * @param reason the reason for the rejection
         */
        function DelayedRejection(milliseconds, reason) {
            _super.call(this, function (resolve, reject) {
                setTimeout(reason ? reject.bind(this, reason) : reject.bind(this), milliseconds);
            });
        }
        return DelayedRejection;
    })(Promise_1.default);
    exports.DelayedRejection = DelayedRejection;
    ;
});
//# sourceMappingURL=../_debug/async/timing.js.map