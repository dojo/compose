(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports"], function (require, exports) {
    /**
     * This class is used internally by {@link ReadableStream} and {@link WritableStream} as a simple queue.
     * Each value in the queue includes a piece of metadata: the size of the value.
     */
    var SizeQueue = (function () {
        function SizeQueue() {
            this._queue = [];
        }
        Object.defineProperty(SizeQueue.prototype, "totalSize", {
            get: function () {
                var totalSize = 0;
                this._queue.forEach(function (pair) {
                    totalSize += pair.size;
                });
                return totalSize;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(SizeQueue.prototype, "length", {
            get: function () {
                return this._queue.length;
            },
            enumerable: true,
            configurable: true
        });
        SizeQueue.prototype.empty = function () {
            this._queue = [];
        };
        SizeQueue.prototype.enqueue = function (value, size) {
            this._queue.push({ value: value, size: size });
        };
        SizeQueue.prototype.dequeue = function () {
            var pair = this._queue.shift();
            return pair.value;
        };
        SizeQueue.prototype.peek = function () {
            var pair = this._queue[0];
            return pair.value;
        };
        return SizeQueue;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = SizeQueue;
});
//# sourceMappingURL=../_debug/streams/SizeQueue.js.map