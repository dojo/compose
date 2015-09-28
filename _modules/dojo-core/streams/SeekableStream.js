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
})(["require", "exports", '../Promise', './ReadableStream', './SeekableStreamReader'], function (require, exports) {
    var Promise_1 = require('../Promise');
    var ReadableStream_1 = require('./ReadableStream');
    var SeekableStreamReader_1 = require('./SeekableStreamReader');
    var SeekableStream = (function (_super) {
        __extends(SeekableStream, _super);
        /**
         * @param preventClose (default=true) Prevent the stream from closing when it reaches the end.
         * If true, the stream will not close when requestClose is called on the controller (which is typically done by the
         * source when it reaches its end). This allows for re-seeking in a stream that has already been read to the end.
         * The stream can be closed by calling ReadableStream#close.
         */
        function SeekableStream(underlyingSource, strategy, preventClose) {
            if (strategy === void 0) { strategy = {}; }
            if (preventClose === void 0) { preventClose = true; }
            _super.call(this, underlyingSource, strategy);
            this.preventClose = preventClose;
        }
        SeekableStream.prototype.getReader = function () {
            if (!this.readable || !this.seek) {
                throw new TypeError('Must be a SeekableStream instance');
            }
            return new SeekableStreamReader_1.default(this);
        };
        SeekableStream.prototype.requestClose = function () {
            if (!this.preventClose) {
                _super.prototype.requestClose.call(this);
            }
        };
        SeekableStream.prototype.seek = function (position) {
            var _this = this;
            if (this._underlyingSource.seek) {
                return this._underlyingSource.seek(this.controller, position);
            }
            else {
                if (this.reader && position < this.reader.currentPosition) {
                    return Promise_1.default.reject(new Error('Stream source is not seekable; cannot seek backwards'));
                }
                else {
                    var discardNext = function () {
                        return _this.reader.read().then(function (result) {
                            if (result.done || _this.reader.currentPosition === position) {
                                return Promise_1.default.resolve(_this.reader.currentPosition);
                            }
                            else {
                                return discardNext();
                            }
                        });
                    };
                    return discardNext();
                }
            }
        };
        Object.defineProperty(SeekableStream.prototype, "strategy", {
            get: function () {
                return this._strategy;
            },
            enumerable: true,
            configurable: true
        });
        return SeekableStream;
    })(ReadableStream_1.default);
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = SeekableStream;
});
//# sourceMappingURL=../_debug/streams/SeekableStream.js.map