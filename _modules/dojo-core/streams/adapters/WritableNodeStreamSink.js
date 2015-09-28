(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../../Promise'], function (require, exports) {
    var Promise_1 = require('../../Promise');
    var WritableNodeStreamSink = (function () {
        function WritableNodeStreamSink(nodeStream, encoding) {
            if (encoding === void 0) { encoding = ''; }
            this._isClosed = false;
            this._encoding = encoding;
            this._nodeStream = nodeStream;
            this._onError = this._handleError.bind(this);
            this._nodeStream.on('error', this._onError);
        }
        WritableNodeStreamSink.prototype._handleError = function (error) {
            this._isClosed = true;
            this._removeListeners();
            if (this._rejectWritePromise) {
                this._rejectWritePromise(error);
                this._rejectWritePromise = undefined;
            }
            throw error;
        };
        WritableNodeStreamSink.prototype._removeListeners = function () {
            this._nodeStream.removeListener('error', this._onError);
        };
        WritableNodeStreamSink.prototype.abort = function (reason) {
            // TODO: is there anything else to do here?
            return this.close();
        };
        WritableNodeStreamSink.prototype.close = function () {
            var _this = this;
            this._isClosed = true;
            this._removeListeners();
            return new Promise_1.default(function (resolve, reject) {
                // TODO: if the node stream returns an error from 'end', should we:
                // 1. reject this.close with the error? (implemented)
                // 2. put 'this' into an error state? (this._handleError)
                _this._nodeStream.end(null, null, function (error) {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            });
        };
        WritableNodeStreamSink.prototype.start = function () {
            if (this._isClosed) {
                return Promise_1.default.reject(new Error('Stream is closed'));
            }
            return Promise_1.default.resolve();
        };
        WritableNodeStreamSink.prototype.write = function (chunk) {
            var _this = this;
            if (this._isClosed) {
                return Promise_1.default.reject(new Error('Stream is closed'));
            }
            return new Promise_1.default(function (resolve, reject) {
                _this._rejectWritePromise = reject;
                _this._nodeStream.write(chunk, _this._encoding, function (error) {
                    if (error) {
                        _this._handleError(error);
                    }
                    else {
                        _this._rejectWritePromise = undefined;
                        resolve();
                    }
                });
            });
        };
        return WritableNodeStreamSink;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = WritableNodeStreamSink;
});
//# sourceMappingURL=../../_debug/streams/adapters/WritableNodeStreamSink.js.map