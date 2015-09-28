(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../Promise', './ReadableStream'], function (require, exports) {
    var Promise_1 = require('../Promise');
    var ReadableStream_1 = require('./ReadableStream');
    function isReadableStreamReader(readableStreamReader) {
        return Object.prototype.hasOwnProperty.call(readableStreamReader, '_ownerReadableStream');
    }
    /**
     * This class provides the interface for reading data from a stream. A reader can by acquired by calling
     * {@link ReadableStream#getReader}. A {@link ReadableStream} can only have a single reader at any time. A reader can
     * be released from the stream by calling {@link ReadableStreamReader.releaseLock}. If the stream still has data, a new
     * reader can be acquired to read from the stream.
     */
    var ReadableStreamReader = (function () {
        function ReadableStreamReader(stream) {
            var _this = this;
            if (!stream.readable) {
                throw new TypeError('3.4.3-1: stream must be a ReadableStream');
            }
            if (stream.locked) {
                throw new TypeError('3.4.3-2: stream cannot be locked');
            }
            stream.reader = this;
            this._ownerReadableStream = stream;
            this.state = ReadableStream_1.State.Readable;
            this._storedError = undefined;
            this._readRequests = [];
            this._closedPromise = new Promise_1.default(function (resolve, reject) {
                _this._resolveClosedPromise = resolve;
                _this._rejectClosedPromise = reject;
            });
        }
        Object.defineProperty(ReadableStreamReader.prototype, "closed", {
            get: function () {
                return this._closedPromise;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Cancel a stream. The reader is released and the stream is closed. {@link ReadableStream.Source#cancel} is
         * called with the provided `reason`.
         *
         * @param reason The reason for canceling the stream
         */
        ReadableStreamReader.prototype.cancel = function (reason) {
            if (!isReadableStreamReader(this)) {
                return Promise_1.default.reject(new TypeError('3.4.4.2-1: Must be a ReadableStreamReader instance'));
            }
            if (this.state === ReadableStream_1.State.Closed) {
                return Promise_1.default.resolve();
            }
            if (this.state === ReadableStream_1.State.Errored) {
                return Promise_1.default.reject(this._storedError);
            }
            if (this._ownerReadableStream && this._ownerReadableStream.state === ReadableStream_1.State.Readable) {
                return this._ownerReadableStream.cancel(reason);
            }
            // 3.4.4.2-4,5 - the spec calls for this to throw an error. We have changed it to reject instead
            return Promise_1.default.reject(new TypeError('3.4.4.2-4,5: Cannot cancel ReadableStreamReader'));
        };
        /**
         * Read data from the stream.
         *
         * @returns A promise that resolves to a {@link ReadResult}.
         */
        // This method also incorporates the ReadFromReadableStreamReader from 3.5.12.
        ReadableStreamReader.prototype.read = function () {
            var _this = this;
            if (!isReadableStreamReader(this)) {
                return Promise_1.default.reject(new TypeError('3.4.4.3-1: Must be a ReadableStreamReader instance'));
            }
            if (this.state === ReadableStream_1.State.Closed) {
                return Promise_1.default.resolve({
                    value: undefined,
                    done: true
                });
            }
            if (this.state === ReadableStream_1.State.Errored) {
                return Promise_1.default.reject(new TypeError('3.5.12-2: reader state is Errored'));
            }
            var stream = this._ownerReadableStream;
            if (!stream || stream.state !== ReadableStream_1.State.Readable) {
                throw new TypeError('3.5.12-3,4: Stream must exist and be readable');
            }
            var queue = stream.queue;
            if (queue.length > 0) {
                var chunk = queue.dequeue();
                if (stream.closeRequested && !queue.length) {
                    stream.close();
                }
                else {
                    stream.pull();
                }
                return Promise_1.default.resolve({
                    value: chunk,
                    done: false
                });
            }
            else {
                var readPromise = new Promise_1.default(function (resolve, reject) {
                    _this._readRequests.push({
                        promise: readPromise,
                        resolve: resolve,
                        reject: reject
                    });
                    stream.pull();
                });
                return readPromise;
            }
        };
        /**
         * Release a reader's lock on the corresponding stream. The reader will no longer be readable. Further reading on
         * the stream can be done by acquiring a new `ReadableStreamReader`.
         */
        // 3.4.4.4. releaseLock()
        ReadableStreamReader.prototype.releaseLock = function () {
            if (!isReadableStreamReader(this)) {
                throw new TypeError('3.4.4.4-1: Must be a ReadableStreamReader isntance');
            }
            if (!this._ownerReadableStream) {
                return;
            }
            if (this._readRequests.length) {
                throw new TypeError('3.4.4.4-3: Tried to release a reader lock when that reader has pending read calls un-settled');
            }
            this.release();
        };
        // 3.5.13. ReleaseReadableStreamReader ( reader )
        ReadableStreamReader.prototype.release = function () {
            var request;
            if (this._ownerReadableStream.state === ReadableStream_1.State.Errored) {
                this.state = ReadableStream_1.State.Errored;
                var e = this._ownerReadableStream.storedError;
                this._storedError = e;
                this._rejectClosedPromise(e);
                for (var _i = 0, _a = this._readRequests; _i < _a.length; _i++) {
                    request = _a[_i];
                    request.reject(e);
                }
            }
            else {
                this.state = ReadableStream_1.State.Closed;
                this._resolveClosedPromise();
                for (var _b = 0, _c = this._readRequests; _b < _c.length; _b++) {
                    request = _c[_b];
                    request.resolve({
                        value: undefined,
                        done: true
                    });
                }
            }
            this._readRequests = [];
            this._ownerReadableStream.reader = undefined;
            this._ownerReadableStream = undefined;
        };
        /**
         * Resolves a pending read request, if any, with the provided chunk.
         * @param chunk
         * @return boolean True if a read request was resolved.
         */
        ReadableStreamReader.prototype.resolveReadRequest = function (chunk) {
            if (this._readRequests.length > 0) {
                this._readRequests.shift().resolve({
                    value: chunk,
                    done: false
                });
                return true;
            }
            return false;
        };
        return ReadableStreamReader;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = ReadableStreamReader;
});
//# sourceMappingURL=../_debug/streams/ReadableStreamReader.js.map