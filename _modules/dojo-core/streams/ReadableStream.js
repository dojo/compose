(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../Promise', './ReadableStreamController', './ReadableStreamReader', './SizeQueue', './util', './WritableStream'], function (require, exports) {
    var Promise_1 = require('../Promise');
    var ReadableStreamController_1 = require('./ReadableStreamController');
    var ReadableStreamReader_1 = require('./ReadableStreamReader');
    var SizeQueue_1 = require('./SizeQueue');
    var util = require('./util');
    var WritableStream_1 = require('./WritableStream');
    /**
     * `ReadableStream`'s possible states
     */
    (function (State) {
        State[State["Readable"] = 0] = "Readable";
        State[State["Closed"] = 1] = "Closed";
        State[State["Errored"] = 2] = "Errored";
    })(exports.State || (exports.State = {}));
    var State = exports.State;
    /**
     * Implementation of a readable stream.
     */
    var ReadableStream = (function () {
        /**
         * A `ReadableStream` requires an underlying source to supply data. The source interacts with the stream through
         * a {@link ReadableStreamController} that is associated with the stream, and provided to the source.
         *
         * @constructor
         * @param underlyingSource The source object that supplies data to the stream by interacting with its controller.
         * @param strategy The strategy for this stream.
         */
        function ReadableStream(underlyingSource, strategy) {
            var _this = this;
            if (strategy === void 0) { strategy = {}; }
            this.closeRequested = false;
            if (!underlyingSource) {
                throw new Error('An ReadableStream Source must be provided.');
            }
            this.state = State.Readable;
            this._underlyingSource = underlyingSource;
            this.controller = new ReadableStreamController_1.default(this);
            this._strategy = util.normalizeStrategy(strategy);
            this.queue = new SizeQueue_1.default();
            this._startedPromise = new Promise_1.default(function (resolveStarted) {
                var startResult = util.invokeOrNoop(_this._underlyingSource, 'start', [_this.controller]);
                Promise_1.default.resolve(startResult).then(function () {
                    _this._started = true;
                    resolveStarted();
                    _this.pull();
                }, function (error) {
                    _this.error(error);
                });
            });
        }
        Object.defineProperty(ReadableStream.prototype, "_allowPull", {
            // ShouldReadableStreamPull
            get: function () {
                return !this.pullScheduled &&
                    !this.closeRequested &&
                    this._started &&
                    this.state !== State.Closed &&
                    this.state !== State.Errored &&
                    !this._shouldApplyBackPressure();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ReadableStream.prototype, "desiredSize", {
            /**
             * Returns a number indicating how much additional data can be pushed by the source to the stream's queue before it
             * exceeds its `highWaterMark`. An underlying source should use this information to determine when and how to apply
             * backpressure.
             *
             * @returns The stream's strategy's `highWaterMark` value minus the queue size
             */
            // 3.5.7. GetReadableStreamDesiredSize ( stream )
            get: function () {
                return this._strategy.highWaterMark - this.queueSize;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ReadableStream.prototype, "hasSource", {
            get: function () {
                return this._underlyingSource != null;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ReadableStream.prototype, "locked", {
            /**
             * A stream can only have one reader at a time. This value indicates if a stream already has a reader, and hence
             * cannot be read from other than by that reader. When a consumer is done with a reader they can dissociate it
             * by calling {@link ReadableStreamReader#releaseLock}.
             *
             * @returns True if the stream has a reader associated with it
             */
            // IsReadableStreamLocked
            get: function () {
                return this.hasSource && !!this.reader;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ReadableStream.prototype, "readable", {
            get: function () {
                return this.hasSource && this.state === State.Readable;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ReadableStream.prototype, "started", {
            /**
             * This promise will resolve when the stream's underlying source has started and is ready to provide data. If
             * the {@link ReadableStreamReader#read} method is called before the stream has started it will not do anything.
             * Wait for this promise to resolve to ensure that your `read` calls are responded to as promptly as possible.
             *
             * @returns A promise that resolves when the stream is ready to be read from.
             */
            get: function () {
                return this._startedPromise;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ReadableStream.prototype, "queueSize", {
            get: function () {
                return this.queue.totalSize;
            },
            enumerable: true,
            configurable: true
        });
        ReadableStream.prototype._cancel = function (reason) {
            // 3.2.4.1-3: return cancelReadableStream(this, reason);
            if (this.state === State.Closed) {
                return Promise_1.default.resolve();
            }
            if (this.state === State.Errored) {
                return Promise_1.default.reject(new TypeError('3.5.3-2: State is errored'));
            }
            this.queue.empty();
            this.close();
            return util.promiseInvokeOrNoop(this._underlyingSource, 'cancel', [reason]).then(function () { });
        };
        // shouldReadableStreamApplyBackPressure
        ReadableStream.prototype._shouldApplyBackPressure = function () {
            var queueSize = this.queue.totalSize;
            return queueSize > this._strategy.highWaterMark;
        };
        /**
         *
         * @param reason A description of the reason the stream is being canceled.
         * @returns A promise that resolves when the stream has closed and the call to the underlying source's `cancel`
         * method has completed.
         */
        ReadableStream.prototype.cancel = function (reason) {
            if (!this.hasSource) {
                return Promise_1.default.reject(new TypeError('3.2.4.1-1: Must be a ReadableStream'));
            }
            return this._cancel(reason);
        };
        /**
         * Closes the stream without regard to the status of the queue.  Use {@link requestClose} to close the
         * stream and allow the queue to flush.
         *
         */
        // 3.5.4. FinishClosingReadableStream ( stream )
        ReadableStream.prototype.close = function () {
            if (this.state !== State.Readable) {
                return;
            }
            this.state = State.Closed;
            if (this.locked) {
                this.reader.release();
            }
        };
        // EnqueueInReadableStream
        ReadableStream.prototype.enqueue = function (chunk) {
            var size = this._strategy.size;
            if (!this.readable || this.closeRequested) {
                throw new Error('3.5.6-1,2: Stream._state should be Readable and stream.closeRequested should be true');
            }
            if (!this.locked || !this.reader.resolveReadRequest(chunk)) {
                try {
                    var chunkSize = 1;
                    if (size) {
                        chunkSize = size(chunk);
                    }
                    this.queue.enqueue(chunk, chunkSize);
                }
                catch (error) {
                    this.error(error);
                    throw error;
                }
            }
            this.pull();
        };
        ReadableStream.prototype.error = function (error) {
            if (this.state !== State.Readable) {
                throw new Error('3.5.7-1: State must be Readable');
            }
            this.queue.empty();
            this.storedError = error;
            this.state = State.Errored;
            if (this.locked) {
                this.reader.release();
            }
        };
        /**
         * create a new {@link ReadableStreamReader} and lock the stream to the new reader
         */
        // AcquireReadableStreamReader
        ReadableStream.prototype.getReader = function () {
            if (!this.readable) {
                throw new TypeError('3.2.4.2-1: must be a ReadableStream instance');
            }
            return new ReadableStreamReader_1.default(this);
        };
        ReadableStream.prototype.pipeThrough = function (transformStream, options) {
            this.pipeTo(transformStream.writable, options);
            return transformStream.readable;
        };
        ReadableStream.prototype.pipeTo = function (dest, options) {
            var _this = this;
            if (options === void 0) { options = {}; }
            var resolvePipeToPromise;
            var rejectPipeToPromise;
            var closedPurposefully = false;
            var lastRead;
            var reader;
            function doPipe() {
                lastRead = reader.read();
                Promise_1.default.all([lastRead, dest.ready]).then(function (_a) {
                    var readResult = _a[0];
                    if (readResult.done) {
                        closeDest();
                    }
                    else if (dest.state === WritableStream_1.State.Writable) {
                        dest.write(readResult.value);
                        doPipe();
                    }
                });
            }
            function cancelSource(reason) {
                if (!options.preventCancel) {
                    reader.cancel(reason);
                    rejectPipeToPromise(reason);
                }
                else {
                    lastRead.then(function () {
                        reader.releaseLock();
                        rejectPipeToPromise(reason);
                    });
                }
            }
            function closeDest() {
                var destState = dest.state;
                if (!options.preventClose &&
                    (destState === WritableStream_1.State.Waiting || destState === WritableStream_1.State.Writable)) {
                    closedPurposefully = true;
                    dest.close().then(resolvePipeToPromise, rejectPipeToPromise);
                }
                else {
                    resolvePipeToPromise();
                }
            }
            return new Promise_1.default(function (resolve, reject) {
                resolvePipeToPromise = resolve;
                rejectPipeToPromise = reject;
                reader = _this.getReader();
                reader.closed.catch(function (reason) {
                    // abortDest
                    if (!options.preventAbort) {
                        dest.abort(reason);
                    }
                    rejectPipeToPromise(reason);
                });
                dest.closed.then(function () {
                    if (!closedPurposefully) {
                        cancelSource(new TypeError('destination is closing or closed and cannot be piped to anymore'));
                    }
                }, cancelSource);
                doPipe();
            });
        };
        // RequestReadableStreamPull
        ReadableStream.prototype.pull = function () {
            var _this = this;
            if (!this._allowPull) {
                return;
            }
            if (this._pullingPromise) {
                this.pullScheduled = true;
                this._pullingPromise.then(function () {
                    _this.pullScheduled = false;
                    _this.pull();
                });
                return;
            }
            this._pullingPromise = util.promiseInvokeOrNoop(this._underlyingSource, 'pull', [this.controller]);
            this._pullingPromise.then(function () {
                _this._pullingPromise = undefined;
            }, function (error) {
                _this.error(error);
            });
        };
        /**
         * Requests the stream be closed.  This method allows the queue to be emptied before the stream closes.
         *
         */
        // 3.5.3. CloseReadableStream ( stream )
        ReadableStream.prototype.requestClose = function () {
            if (this.closeRequested || this.state !== State.Readable) {
                return;
            }
            this.closeRequested = true;
            if (this.queue.length === 0) {
                this.close();
            }
        };
        /**
         * Tee a readable stream, returning a two-element array containing
         * the two resulting ReadableStream instances
         */
        // TeeReadableStream
        ReadableStream.prototype.tee = function () {
            var _this = this;
            if (!this.readable) {
                throw new TypeError('3.2.4.5-1: must be a ReadableSream');
            }
            var branch1;
            var branch2;
            var reader = this.getReader();
            var teeState = {
                closedOrErrored: false,
                canceled1: false,
                canceled2: false,
                reason1: undefined,
                reason2: undefined
            };
            teeState.promise = new Promise_1.default(function (resolve) {
                teeState._resolve = resolve;
            });
            var createCancelFunction = function (branch) {
                return function (reason) {
                    teeState['canceled' + branch] = true;
                    teeState['reason' + branch] = reason;
                    if (teeState['canceled' + (branch === 1 ? 2 : 1)]) {
                        var cancelResult = _this._cancel([teeState.reason1, teeState.reason2]);
                        teeState._resolve(cancelResult);
                    }
                    return teeState.promise;
                };
            };
            var pull = function (controller) {
                return reader.read().then(function (result) {
                    var value = result.value;
                    var done = result.done;
                    if (done && !teeState.closedOrErrored) {
                        branch1.requestClose();
                        branch2.requestClose();
                        teeState.closedOrErrored = true;
                    }
                    if (teeState.closedOrErrored) {
                        return;
                    }
                    if (!teeState.canceled1) {
                        branch1.enqueue(value);
                    }
                    if (!teeState.canceled2) {
                        branch2.enqueue(value);
                    }
                });
            };
            var cancel1 = createCancelFunction(1);
            var cancel2 = createCancelFunction(2);
            var underlyingSource1 = {
                pull: pull,
                cancel: cancel1
            };
            branch1 = new ReadableStream(underlyingSource1);
            var underlyingSource2 = {
                pull: pull,
                cancel: cancel2
            };
            branch2 = new ReadableStream(underlyingSource2);
            reader.closed.catch(function (r) {
                if (teeState.closedOrErrored) {
                    return;
                }
                branch1.error(r);
                branch2.error(r);
                teeState.closedOrErrored = true;
            });
            return [branch1, branch2];
        };
        return ReadableStream;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = ReadableStream;
});
//# sourceMappingURL=../_debug/streams/ReadableStream.js.map