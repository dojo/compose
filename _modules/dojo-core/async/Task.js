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
})(["require", "exports", '../Promise'], function (require, exports) {
    var Promise_1 = require('../Promise');
    exports.Canceled = 4;
    /**
     * Task is an extension of Promise that supports cancelation.
     */
    var Task = (function (_super) {
        __extends(Task, _super);
        function Task(executor, canceler) {
            var _this = this;
            _super.call(this, function (resolve, reject) {
                // Don't let the Task resolve if it's been canceled
                executor(function (value) {
                    if (_this._state === exports.Canceled) {
                        return;
                    }
                    resolve(value);
                }, function (reason) {
                    if (_this._state === exports.Canceled) {
                        return;
                    }
                    reject(reason);
                });
            });
            this.children = [];
            this.canceler = function () {
                if (canceler) {
                    canceler();
                }
                _this._cancel();
            };
        }
        Task.all = function (items) {
            return _super.all.call(this, items);
        };
        Task.race = function (items) {
            return _super.race.call(this, items);
        };
        Task.reject = function (reason) {
            return _super.reject.call(this, reason);
        };
        Task.resolve = function (value) {
            return _super.resolve.call(this, value);
        };
        Task.copy = function (other) {
            var task = _super.copy.call(this, other);
            task.children = [];
            task.canceler = other instanceof Task ? other.canceler : function () { };
            return task;
        };
        /**
         * Propagates cancelation down through a Task tree. The Task's state is immediately set to canceled. If a Thenable
         * finally task was passed in, it is resolved before calling this Task's finally callback; otherwise, this Task's
         * finally callback is immediately executed. `_cancel` is called for each child Task, passing in the value returned
         * by this Task's finally callback or a Promise chain that will eventually resolve to that value.
         */
        Task.prototype._cancel = function (finallyTask) {
            var _this = this;
            this._state = exports.Canceled;
            var runFinally = function () {
                try {
                    return _this._finally();
                }
                catch (error) {
                }
            };
            if (this._finally) {
                if (Promise_1.isThenable(finallyTask)) {
                    finallyTask = finallyTask.then(runFinally, runFinally);
                }
                else {
                    finallyTask = runFinally();
                }
            }
            this.children.forEach(function (child) {
                child._cancel(finallyTask);
            });
        };
        /**
         * Immediately cancels this task if it has not already resolved. This Task and any descendants are synchronously set
         * to the Canceled state and any `finally` added downstream from the canceled Task are invoked.
         */
        Task.prototype.cancel = function () {
            if (this._state === Promise_1.State.Pending) {
                this.canceler();
            }
        };
        Task.prototype.finally = function (callback) {
            var task = _super.prototype.finally.call(this, callback);
            // Keep a reference to the callback; it will be called if the Task is canceled
            task._finally = callback;
            return task;
        };
        Task.prototype.then = function (onFulfilled, onRejected) {
            var _this = this;
            var task = _super.prototype.then.call(this, 
            // Don't call the onFulfilled or onRejected handlers if this Task is canceled
            function (value) {
                if (task._state === exports.Canceled) {
                    return;
                }
                if (onFulfilled) {
                    return onFulfilled(value);
                }
                return value;
            }, function (error) {
                if (task._state === exports.Canceled) {
                    return;
                }
                if (onRejected) {
                    return onRejected(error);
                }
                throw error;
            });
            task.canceler = function () {
                // If task's parent (this) hasn't been resolved, cancel it; downward propagation will start at the first
                // unresolved parent
                if (_this._state === Promise_1.State.Pending) {
                    _this.cancel();
                }
                else {
                    task._cancel();
                }
            };
            // Keep track of child Tasks for propogating cancelation back down the chain
            this.children.push(task);
            return task;
        };
        Task.prototype.catch = function (onRejected) {
            return _super.prototype.catch.call(this, onRejected);
        };
        return Task;
    })(Promise_1.default);
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Task;
});
//# sourceMappingURL=../_debug/async/Task.js.map