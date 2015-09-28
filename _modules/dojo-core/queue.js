(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './global', './has'], function (require, exports) {
    var global_1 = require('./global');
    var has_1 = require('./has');
    function executeTask(item) {
        if (item.isActive) {
            item.callback();
        }
    }
    function getQueueHandle(item, destructor) {
        return {
            destroy: function () {
                this.destroy = function () { };
                item.isActive = false;
                item.callback = null;
                if (destructor) {
                    destructor();
                }
            }
        };
    }
    // When no mechanism for registering microtasks is exposed by the environment, microtasks will
    // be queued and then executed in a single macrotask before the other macrotasks are executed.
    var checkMicroTaskQueue;
    var microTasks;
    if (!has_1.default('microtasks')) {
        var isMicroTaskQueued = false;
        microTasks = [];
        checkMicroTaskQueue = function () {
            if (!isMicroTaskQueued) {
                isMicroTaskQueued = true;
                exports.queueTask(function () {
                    isMicroTaskQueued = false;
                    if (microTasks.length) {
                        var item;
                        while (item = microTasks.shift()) {
                            executeTask(item);
                        }
                    }
                });
            }
        };
    }
    /**
     * Schedules a callback to the macrotask queue.
     *
     * @param callback the function to be queued and later executed.
     * @returns An object with a `destroy` method that, when called, prevents the registered callback from executing.
     */
    exports.queueTask = (function () {
        var destructor;
        var enqueue;
        // Since the IE implementation of `setImmediate` is not flawless, we will test for `postMessage` first.
        if (has_1.default('postmessage')) {
            var queue = [];
            global_1.default.addEventListener('message', function (event) {
                // Confirm that the event was triggered by the current window and by this particular implementation.
                if (event.source === global_1.default && event.data === 'dojo-queue-message') {
                    event.stopPropagation();
                    if (queue.length) {
                        executeTask(queue.shift());
                    }
                }
            });
            enqueue = function (item) {
                queue.push(item);
                global_1.default.postMessage('dojo-queue-message', '*');
            };
        }
        else if (has_1.default('setimmediate')) {
            destructor = global_1.default.clearImmediate;
            enqueue = function (item) {
                return setImmediate(executeTask.bind(null, item));
            };
        }
        else {
            destructor = global_1.default.clearTimeout;
            enqueue = function (item) {
                return setTimeout(executeTask.bind(null, item), 0);
            };
        }
        function queueTask(callback) {
            var item = {
                isActive: true,
                callback: callback
            };
            var id = enqueue(item);
            return getQueueHandle(item, destructor && function () {
                destructor(id);
            });
        }
        ;
        // TODO: Use aspect.before when it is available.
        return has_1.default('microtasks') ? queueTask : function (callback) {
            checkMicroTaskQueue();
            return queueTask(callback);
        };
    })();
    /**
     * Schedules an animation task with `window.requestAnimationFrame` if it exists, or with `queueTask` otherwise.
     *
     * Since requestAnimationFrame's behavior does not match that expected from `queueTask`, it is not used there.
     * However, at times it makes more sense to delegate to requestAnimationFrame; hence the following method.
     *
     * @param callback the function to be queued and later executed.
     * @returns An object with a `destroy` method that, when called, prevents the registered callback from executing.
     */
    exports.queueAnimationTask = (function () {
        if (!has_1.default('raf')) {
            return exports.queueTask;
        }
        function queueAnimationTask(callback) {
            var item = {
                isActive: true,
                callback: callback
            };
            var rafId = requestAnimationFrame(executeTask.bind(null, item));
            return getQueueHandle(item, function () {
                cancelAnimationFrame(rafId);
            });
        }
        // TODO: Use aspect.before when it is available.
        return has_1.default('microtasks') ? queueAnimationTask : function (callback) {
            checkMicroTaskQueue();
            return queueAnimationTask(callback);
        };
    })();
    /**
     * Schedules a callback to the microtask queue.
     *
     * Any callbacks registered with `queueMicroTask` will be executed before the next macrotask. If no native
     * mechanism for scheduling macrotasks is exposed, then any callbacks will be fired before any macrotask
     * registered with `queueTask` or `queueAnimationTask`.
     *
     * @param callback the function to be queued and later executed.
     * @returns An object with a `destroy` method that, when called, prevents the registered callback from executing.
     */
    exports.queueMicroTask = (function () {
        var enqueue;
        if (has_1.default('host-node')) {
            enqueue = function (item) {
                global_1.default.process.nextTick(executeTask.bind(null, item));
            };
        }
        else if (has_1.default('promise')) {
            enqueue = function (item) {
                global_1.default.Promise.resolve(item).then(executeTask);
            };
        }
        else if (has_1.default('dom-mutationobserver')) {
            var HostMutationObserver = global_1.default.MutationObserver || global_1.default.WebKitMutationObserver;
            var node = document.createElement('div');
            var queue = [];
            var observer = new HostMutationObserver(function () {
                while (queue.length > 0) {
                    var item = queue.shift();
                    if (item && item.isActive) {
                        item.callback();
                    }
                }
            });
            observer.observe(node, { attributes: true });
            enqueue = function (item) {
                queue.push(item);
                node.setAttribute('queueStatus', '1');
            };
        }
        else {
            enqueue = function (item) {
                checkMicroTaskQueue();
                microTasks.push(item);
            };
        }
        return function (callback) {
            var item = {
                isActive: true,
                callback: callback
            };
            enqueue(item);
            return getQueueHandle(item);
        };
    })();
});
//# sourceMappingURL=_debug/queue.js.map