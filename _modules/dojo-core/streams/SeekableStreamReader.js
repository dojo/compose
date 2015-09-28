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
})(["require", "exports", '../Promise', './ReadableStreamReader'], function (require, exports) {
    var Promise_1 = require('../Promise');
    var ReadableStreamReader_1 = require('./ReadableStreamReader');
    var SeekableStreamReader = (function (_super) {
        __extends(SeekableStreamReader, _super);
        function SeekableStreamReader() {
            _super.apply(this, arguments);
            this._currentPosition = 0;
        }
        Object.defineProperty(SeekableStreamReader.prototype, "currentPosition", {
            get: function () {
                return this._currentPosition;
            },
            enumerable: true,
            configurable: true
        });
        SeekableStreamReader.prototype.read = function () {
            var _this = this;
            return _super.prototype.read.call(this).then(function (result) {
                if (!result.done) {
                    var chunkSize = 1;
                    try {
                        if (_this._ownerReadableStream.strategy && _this._ownerReadableStream.strategy.size) {
                            chunkSize = _this._ownerReadableStream.strategy.size(result.value);
                        }
                    }
                    catch (error) {
                        _this._ownerReadableStream.error(error);
                        return Promise_1.default.reject(error);
                    }
                    _this._currentPosition += chunkSize;
                }
                return Promise_1.default.resolve(result);
            }, function (error) {
                return Promise_1.default.reject(error);
            });
        };
        SeekableStreamReader.prototype.seek = function (position) {
            var _this = this;
            if (position === this._currentPosition) {
                return Promise_1.default.resolve(this._currentPosition);
            }
            if (position < this._currentPosition) {
                this._ownerReadableStream.queue.empty();
            }
            // Drain the queue of any items prior to the desired seek position
            while (position > this._currentPosition && this._ownerReadableStream.queue.length) {
                var chunkSize = 1;
                var chunk = this._ownerReadableStream.queue.dequeue();
                if (this._ownerReadableStream.strategy && this._ownerReadableStream.strategy.size) {
                    try {
                        chunkSize = this._ownerReadableStream.strategy.size(chunk);
                    }
                    catch (error) {
                        return Promise_1.default.reject(error);
                    }
                }
                this._currentPosition += chunkSize;
            }
            // If there's anything left in the queue, we don't need to seek in the source, we can read from the queue
            if (this._ownerReadableStream.queue.length) {
                return Promise_1.default.resolve(this._currentPosition);
            }
            return this._ownerReadableStream.seek(position).then(function (position) {
                _this._currentPosition = position;
                return Promise_1.default.resolve(position);
            }, function (error) {
                return Promise_1.default.reject(error);
            });
        };
        return SeekableStreamReader;
    })(ReadableStreamReader_1.default);
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = SeekableStreamReader;
});
//# sourceMappingURL=../_debug/streams/SeekableStreamReader.js.map