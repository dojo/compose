(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../Promise'], function (require, exports) {
    var Promise_1 = require('../Promise');
    // Since this Sink is doing no asynchronous operations,
    // use a single resolved promise for all returned promises.
    var resolved = Promise_1.default.resolve();
    /**
     * A WritableStream sink that collects the chunks it receives and
     * stores them into an array.  Use the chunks property to retrieve
     * the collection of chunks.
     */
    var ArraySink = (function () {
        function ArraySink() {
        }
        ArraySink.prototype.abort = function (reason) {
            return resolved;
        };
        ArraySink.prototype.close = function () {
            return Promise_1.default.resolve();
        };
        ArraySink.prototype.start = function (error) {
            this.chunks = [];
            return resolved;
        };
        ArraySink.prototype.write = function (chunk) {
            if (chunk) {
                this.chunks.push(chunk);
            }
            return resolved;
        };
        return ArraySink;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = ArraySink;
});
//# sourceMappingURL=../_debug/streams/ArraySink.js.map