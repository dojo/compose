(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './lang'], function (require, exports) {
    var lang_1 = require('./lang');
    var nextId = 0;
    function advise(dispatcher, type, advice, receiveArguments) {
        var previous = dispatcher[type];
        var advised = {
            id: nextId++,
            advice: advice,
            receiveArguments: receiveArguments
        };
        if (previous) {
            if (type === 'after') {
                // add the listener to the end of the list
                // note that we had to change this loop a little bit to workaround a bizarre IE10 JIT bug
                while (previous.next && (previous = previous.next)) { }
                previous.next = advised;
                advised.previous = previous;
            }
            else {
                // add to the beginning
                dispatcher.before = advised;
                advised.next = previous;
                previous.previous = advised;
            }
        }
        else {
            dispatcher[type] = advised;
        }
        advice = previous = null;
        return lang_1.createHandle(function () {
            var previous = advised.previous;
            var next = advised.next;
            if (!previous && !next) {
                dispatcher[type] = null;
            }
            else {
                if (previous) {
                    previous.next = next;
                }
                else {
                    dispatcher[type] = next;
                }
                if (next) {
                    next.previous = previous;
                }
            }
            dispatcher = advised.advice = advised = null;
        });
    }
    function getDispatcher(target, methodName) {
        var existing = target[methodName];
        var dispatcher;
        if (!existing || existing.target !== target) {
            // no dispatcher
            target[methodName] = dispatcher = function () {
                var executionId = nextId;
                var args = arguments;
                var results;
                var before = dispatcher.before;
                while (before) {
                    if (before.advice) {
                        args = before.advice.apply(this, args) || args;
                    }
                    before = before.next;
                }
                if (dispatcher.around) {
                    results = dispatcher.around.advice(this, args);
                }
                var after = dispatcher.after;
                while (after && after.id < executionId) {
                    if (after.advice) {
                        if (after.receiveArguments) {
                            var newResults = after.advice.apply(this, args);
                            results = newResults === undefined ? results : newResults;
                        }
                        else {
                            results = after.advice.call(this, results, args);
                        }
                    }
                    after = after.next;
                }
                return results;
            };
            if (existing) {
                dispatcher.around = {
                    advice: function (target, args) {
                        return existing.apply(target, args);
                    }
                };
            }
            dispatcher.target = target;
        }
        else {
            dispatcher = existing;
        }
        target = null;
        return dispatcher;
    }
    /**
     * Attaches "after" advice to be executed after the original method.
     * The advising function will receive the original method's return value and arguments object.
     * The value it returns will be returned from the method when it is called (even if the return value is undefined).
     * @param target Object whose method will be aspected
     * @param methodName Name of method to aspect
     * @param advice Advising function which will receive the original method's return value and arguments object
     * @return A handle which will remove the aspect when destroy is called
     */
    function after(target, methodName, advice) {
        return advise(getDispatcher(target, methodName), 'after', advice);
    }
    exports.after = after;
    /**
     * Attaches "around" advice around the original method.
     * @param target Object whose method will be aspected
     * @param methodName Name of method to aspect
     * @param advice Advising function which will receive the original function
     * @return A handle which will remove the aspect when destroy is called
     */
    function around(target, methodName, advice) {
        var dispatcher = getDispatcher(target, methodName);
        var previous = dispatcher.around;
        var advised = advice(function () {
            return previous.advice(this, arguments);
        });
        dispatcher.around = {
            advice: function (target, args) {
                return advised ?
                    advised.apply(target, args) :
                    previous.advice(target, args);
            }
        };
        advice = null;
        return lang_1.createHandle(function () {
            advised = dispatcher = null;
        });
    }
    exports.around = around;
    /**
     * Attaches "before" advice to be executed before the original method.
     * @param target Object whose method will be aspected
     * @param methodName Name of method to aspect
     * @param advice Advising function which will receive the same arguments as the original, and may return new arguments
     * @return A handle which will remove the aspect when destroy is called
     */
    function before(target, methodName, advice) {
        return advise(getDispatcher(target, methodName), 'before', advice);
    }
    exports.before = before;
    /**
     * Attaches advice to be executed after the original method.
     * The advising function will receive the same arguments as the original method.
     * The value it returns will be returned from the method when it is called *unless* its return value is undefined.
     * @param target Object whose method will be aspected
     * @param methodName Name of method to aspect
     * @param advice Advising function which will receive the same arguments as the original method
     * @return A handle which will remove the aspect when destroy is called
     */
    function on(target, methodName, advice) {
        return advise(getDispatcher(target, methodName), 'after', advice, true);
    }
    exports.on = on;
});
//# sourceMappingURL=_debug/aspect.js.map