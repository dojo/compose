(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../Promise', './SizeQueue', './util'], function (require, exports) {
    var Promise_1 = require('../Promise');
    var SizeQueue_1 = require('./SizeQueue');
    var util = require('./util');
    /**
     * WritableStream's possible states
     */
    (function (State) {
        State[State["Closed"] = 0] = "Closed";
        State[State["Closing"] = 1] = "Closing";
        State[State["Errored"] = 2] = "Errored";
        State[State["Waiting"] = 3] = "Waiting";
        State[State["Writable"] = 4] = "Writable";
    })(exports.State || (exports.State = {}));
    var State = exports.State;
    // This function is basically a context check to protect against calling WritableStream methods with incorrect context
    // (as one might accidentally do when passing a method as callback)
    function isWritableStream(x) {
        return Object.prototype.hasOwnProperty.call(x, '_underlyingSink');
    }
    /**
     * This class provides a writable stream implementation. Data written to a stream will be passed on to the underlying
     * sink (`WritableStream.Sink`), an instance of which must be supplied to the stream upon instantation. This class
     * provides the standard stream API, while implementations of the `Sink` API allow the data to be written to
     * various persistence layers.
     */
    var WritableStream = (function () {
        function WritableStream(underlyingSink, strategy) {
            var _this = this;
            if (underlyingSink === void 0) { underlyingSink = {}; }
            if (strategy === void 0) { strategy = {}; }
            this._underlyingSink = underlyingSink;
            this._closedPromise = new Promise_1.default(function (resolve, reject) {
                _this._resolveClosedPromise = resolve;
                _this._rejectClosedPromise = reject;
            });
            this._advancing = false;
            this._readyPromise = Promise_1.default.resolve();
            this._queue = new SizeQueue_1.default();
            this._state = State.Writable;
            this._started = false;
            this._writing = false;
            this._strategy = util.normalizeStrategy(strategy);
            this._syncStateWithQueue();
            this._startedPromise = Promise_1.default.resolve(util.invokeOrNoop(this._underlyingSink, 'start', [this._error.bind(this)])).then(function () {
                _this._started = true;
                _this._startedPromise = undefined;
            }, function (error) {
                _this._error(error);
            });
        }
        Object.defineProperty(WritableStream.prototype, "closed", {
            /**
             * @returns A promise that is resolved when the stream is closed, or is rejected if the stream errors.
             */
            get: function () {
                return this._closedPromise;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WritableStream.prototype, "ready", {
            /**
             * @returns A promise that is resolved when the stream transitions away from the 'waiting' state. The stream will
             * use this to indicate backpressure - an unresolved `ready` promise indicates that writes should not yet be
             * performed.
             */
            get: function () {
                return this._readyPromise;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(WritableStream.prototype, "state", {
            /**
             * @returns The stream's current @State
             */
            get: function () {
                return this._state;
            },
            enumerable: true,
            configurable: true
        });
        // This method combines the logic of two methods:
        // 4.3.1 CallOrScheduleWritableStreamAdvanceQueue
        // 4.3.6 WritableStreamAdvanceQueue
        WritableStream.prototype._advanceQueue = function () {
            var _this = this;
            if (!this._started) {
                if (!this._advancing) {
                    this._advancing = true;
                    this._startedPromise.then(function () {
                        _this._advanceQueue();
                    });
                }
                return;
            }
            if (!this._queue || this._writing) {
                return;
            }
            var writeRecord = this._queue.peek();
            if (writeRecord.close) {
                // TODO: SKIP? Assert 4.3.6-3.a
                if (this.state !== State.Closing) {
                    throw new Error('Invalid record');
                }
                this._queue.dequeue();
                // TODO: SKIP? Assert 4.3.6-3.c
                this._close();
                return;
            }
            this._writing = true;
            util.promiseInvokeOrNoop(this._underlyingSink, 'write', [writeRecord.chunk]).then(function () {
                if (_this.state !== State.Errored) {
                    _this._writing = false;
                    writeRecord.resolve();
                    _this._queue.dequeue();
                    try {
                        _this._syncStateWithQueue();
                    }
                    catch (error) {
                        return _this._error(error);
                    }
                    _this._advanceQueue();
                }
            }, function (error) {
                _this._error(error);
            });
        };
        // 4.3.2 CloseWritableStream
        WritableStream.prototype._close = function () {
            var _this = this;
            if (this.state !== State.Closing) {
                // 4.3.2-1
                throw new Error('WritableStream#_close called while state is not "Closing"');
            }
            util.promiseInvokeOrNoop(this._underlyingSink, 'close').then(function () {
                if (_this.state !== State.Errored) {
                    // TODO: Assert 4.3.2.2-a.ii
                    _this._resolveClosedPromise();
                    _this._state = State.Closed;
                    _this._underlyingSink = undefined;
                }
            }, function (error) {
                _this._error(error);
            });
        };
        // 4.3.3 ErrorWritableStream
        WritableStream.prototype._error = function (error) {
            if (this.state === State.Closed || this.state === State.Errored) {
                return;
            }
            var writeRecord;
            while (this._queue.length) {
                writeRecord = this._queue.dequeue();
                if (!writeRecord.close) {
                    writeRecord.reject(error);
                }
            }
            this._storedError = error;
            if (this.state === State.Waiting) {
                this._resolveReadyPromise();
            }
            this._rejectClosedPromise(error);
            this._state = State.Errored;
        };
        // 4.3.5 SyncWritableStreamStateWithQueue
        WritableStream.prototype._syncStateWithQueue = function () {
            var _this = this;
            if (this.state === State.Closing) {
                return;
            }
            var queueSize = this._queue.totalSize;
            var shouldApplyBackPressure = queueSize > this._strategy.highWaterMark;
            if (shouldApplyBackPressure && this.state === State.Writable) {
                this._state = State.Waiting;
                this._readyPromise = new Promise_1.default(function (resolve, reject) {
                    _this._resolveReadyPromise = resolve;
                    _this._rejectReadyPromise = reject;
                });
            }
            if (shouldApplyBackPressure === false && this.state === State.Waiting) {
                this._state = State.Writable;
                this._resolveReadyPromise();
            }
        };
        /**
         * Signals that the producer can no longer write to the stream and it should be immediately moved to an "errored"
         * state. Any un-written data that is queued will be discarded.
         */
        WritableStream.prototype.abort = function (reason) {
            // 4.2.4.4-1
            if (!isWritableStream(this)) {
                return Promise_1.default.reject(new Error('WritableStream method called in context of object that is not a WritableStream instance'));
            }
            if (this.state === State.Closed) {
                // 4.2.4.4-2
                return Promise_1.default.resolve();
            }
            if (this.state === State.Errored) {
                // 4.2.4.4-3
                return Promise_1.default.reject(this._storedError);
            }
            var error = reason instanceof Error ? reason : new Error(reason);
            this._error(error);
            return util.promiseInvokeOrFallbackOrNoop(this._underlyingSink, 'abort', [reason], 'close')
                .then(function () {
                return;
            });
        };
        /**
         * Signals that the producer is done writing to the stream and wishes to move it to a "closed" state. The stream
         * may have un-writted data queued; until the data has been written the stream will remain in the "closing" state.
         */
        WritableStream.prototype.close = function () {
            // 4.2.4.5-1
            if (!isWritableStream(this)) {
                return Promise_1.default.reject(new Error('WritableStream method called in context of object that is not a WritableStream instance'));
            }
            // 4.2.4.5-2
            if (this.state === State.Closed) {
                return Promise_1.default.reject(new TypeError('Stream is already closed'));
            }
            if (this.state === State.Closing) {
                return Promise_1.default.reject(new TypeError('Stream is already closing'));
            }
            if (this.state === State.Errored) {
                // 4.2.4.5-3
                return Promise_1.default.reject(this._storedError);
            }
            if (this.state === State.Waiting) {
                // 4.2.4.5-4
                this._resolveReadyPromise();
            }
            this._state = State.Closing;
            this._queue.enqueue({ close: true }, 0);
            this._advanceQueue();
            return this._closedPromise;
        };
        /**
         * Enqueue a chunk of data to be written to the underlying sink. `write` can be called successively without waiting
         * for the previous write's promise to resolve. To respect the stream's backpressure indicator, check if the stream
         * has entered the "waiting" state between writes.
         *
         * @returns A promise that will be fulfilled when the chunk has been written to the underlying sink.
         */
        WritableStream.prototype.write = function (chunk) {
            // 4.2.4.6-1
            if (!isWritableStream(this)) {
                return Promise_1.default.reject(new Error('WritableStream method called in context of object that is not a WritableStream instance'));
            }
            // 4.2.4.6-2
            if (this.state === State.Closed) {
                return Promise_1.default.reject(new TypeError('Stream is closed'));
            }
            if (this.state === State.Closing) {
                return Promise_1.default.reject(new TypeError('Stream is closing'));
            }
            if (this.state === State.Errored) {
                // 4.2.4.6-3
                return Promise_1.default.reject(this._storedError);
            }
            var chunkSize = 1;
            var writeRecord;
            var promise = new Promise_1.default(function (resolve, reject) {
                writeRecord = {
                    chunk: chunk,
                    reject: reject,
                    resolve: resolve
                };
            });
            // 4.2.4.6-6.b
            try {
                if (this._strategy && this._strategy.size) {
                    chunkSize = this._strategy.size(chunk);
                }
                this._queue.enqueue(writeRecord, chunkSize);
                this._syncStateWithQueue();
            }
            catch (error) {
                // 4.2.4.6-6.b, 4.2.4.6-10, 4.2.4.6-12
                this._error(error);
                return Promise_1.default.reject(error);
            }
            this._advanceQueue();
            return promise;
        };
        return WritableStream;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = WritableStream;
});
//# sourceMappingURL=../_debug/streams/WritableStream.js.map