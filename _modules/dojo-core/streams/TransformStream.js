// This is a simple adaptation to TypeScript of the reference implementation (as of May 2015):
// https://github.com/whatwg/streams/blob/master/reference-implementation/lib/transform-stream.js
(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../Promise', './ReadableStream', './WritableStream'], function (require, exports) {
    var Promise_1 = require('../Promise');
    var ReadableStream_1 = require('./ReadableStream');
    var WritableStream_1 = require('./WritableStream');
    /**
     * A `TransformStream` is both readable and writable. Its purpose is to apply some transform logic to everything that
     * is written to it and provide the transformed data via its reader. As such, it requires no `ReadableStream`,
     * `WritableStream`, or `Source` or `Sink` to be supplied - it provides its own.
     *
     * It does require an object that implements the {@link Transform} interface to be supplied. The `transform` method
     * will be applied to all data written to the stream.
     *
     * The readable stream API is available via the `TransformStream`'s `readable` property, which is a
     * {@link ReadableStream}. The writable stream API is available via the `TransformStream`'s `writable` property, which
     * is a {@link WritableStream}.
     */
    var TransformStream = (function () {
        function TransformStream(transformer) {
            var writeChunk;
            var writeDone;
            var errorWritable;
            var transforming = false;
            var chunkWrittenButNotYetTransformed = false;
            var enqueueInReadable;
            var closeReadable;
            var errorReadable;
            function maybeDoTransform() {
                if (!transforming) {
                    transforming = true;
                    try {
                        transformer.transform(writeChunk, enqueueInReadable, transformDone);
                        writeChunk = undefined;
                        chunkWrittenButNotYetTransformed = false;
                    }
                    catch (e) {
                        transforming = false;
                        errorWritable(e);
                        errorReadable(e);
                    }
                }
            }
            function transformDone() {
                transforming = false;
                writeDone();
            }
            this.writable = new WritableStream_1.default({
                abort: function () {
                    return Promise_1.default.resolve();
                },
                start: function (error) {
                    errorWritable = error;
                    return Promise_1.default.resolve();
                },
                write: function (chunk) {
                    writeChunk = chunk;
                    chunkWrittenButNotYetTransformed = true;
                    var promise = new Promise_1.default(function (resolve) {
                        writeDone = resolve;
                    });
                    maybeDoTransform();
                    return promise;
                },
                close: function () {
                    try {
                        transformer.flush(enqueueInReadable, closeReadable);
                        return Promise_1.default.resolve();
                    }
                    catch (e) {
                        errorWritable(e);
                        errorReadable(e);
                        return Promise_1.default.reject(e);
                    }
                }
            }, transformer.writableStrategy);
            this.readable = new ReadableStream_1.default({
                start: function (controller) {
                    enqueueInReadable = controller.enqueue.bind(controller);
                    closeReadable = controller.close.bind(controller);
                    errorReadable = controller.error.bind(controller);
                    return Promise_1.default.resolve();
                },
                pull: function (controller) {
                    if (chunkWrittenButNotYetTransformed) {
                        maybeDoTransform();
                    }
                    return Promise_1.default.resolve();
                },
                cancel: function () {
                    return Promise_1.default.resolve();
                }
            }, transformer.readableStrategy);
        }
        return TransformStream;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = TransformStream;
});
//# sourceMappingURL=../_debug/streams/TransformStream.js.map