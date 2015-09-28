(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../Promise'], function (require, exports) {
    var Promise_1 = require('../Promise');
    var resolved = Promise_1.default.resolve();
    /**
     * A seekable array source
     */
    var ArraySource = (function () {
        function ArraySource(data) {
            this.currentPosition = 0;
            this.data = [];
            if (data && data.length) {
                this.data = this.data.concat(data);
            }
        }
        ArraySource.prototype.seek = function (controller, position) {
            if (position >= this.data.length || position < 0) {
                var error = new Error('Invalid seek position: ' + position);
                controller.error(error);
                return Promise_1.default.reject(error);
            }
            this.currentPosition = position;
            return Promise_1.default.resolve(this.currentPosition);
        };
        ArraySource.prototype.start = function (controller) {
            return resolved;
        };
        ArraySource.prototype.pull = function (controller) {
            if (this.currentPosition >= this.data.length) {
                controller.close();
            }
            else {
                this.currentPosition += 1;
                controller.enqueue(this.data[this.currentPosition - 1]);
            }
            return resolved;
        };
        ArraySource.prototype.cancel = function (reason) {
            return resolved;
        };
        return ArraySource;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = ArraySource;
});
//# sourceMappingURL=../_debug/streams/ArraySource.js.map