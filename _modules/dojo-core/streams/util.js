(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../Promise'], function (require, exports) {
    var Promise_1 = require('../Promise');
    /*
    Based on sizeof.js by Stephen Morley
    
    A function to calculate the approximate memory usage of objects
    
    Created by Stephen Morley - http://code.stephenmorley.org/ - and released under
    the terms of the CC0 1.0 Universal legal code:
    
    http://creativecommons.org/publicdomain/zero/1.0/legalcode
    
    Returns the approximate memory usage, in bytes, of the specified object.
    */
    function getApproximateByteSize(object) {
        var objects = [object];
        var size = 0;
        for (var index = 0; index < objects.length; index++) {
            switch (typeof objects[index]) {
                case 'boolean':
                    size += 4;
                    break;
                case 'number':
                    size += 8;
                    break;
                case 'string':
                    size += 2 * objects[index].length;
                    break;
                case 'object':
                    // if the object is not an array, add the sizes of the keys
                    if (Object.prototype.toString.call(objects[index]) !== '[object Array]') {
                        for (var key in objects[index]) {
                            size += 2 * key.length;
                        }
                    }
                    // loop over the keys
                    for (var key in objects[index]) {
                        // determine whether the value has already been processed
                        var processed = false;
                        for (var j = 0; j < objects.length; j++) {
                            if (objects[j] === objects[index][key]) {
                                processed = true;
                                break;
                            }
                        }
                        // queue the value to be processed if appropriate
                        if (!processed) {
                            objects.push(objects[index][key]);
                        }
                    }
            }
        }
        return size;
    }
    exports.getApproximateByteSize = getApproximateByteSize;
    /**
     * Calls the method or returns undefined.
     */
    function invokeOrNoop(O, P, args) {
        if (args === void 0) { args = []; }
        var method = O[P];
        return method ? method.apply(O, args) : undefined;
    }
    exports.invokeOrNoop = invokeOrNoop;
    function normalizeStrategy(_a) {
        var size = _a.size, _b = _a.highWaterMark, highWaterMark = _b === void 0 ? 1 : _b;
        return {
            size: size,
            highWaterMark: highWaterMark > 0 ? highWaterMark : 1
        };
    }
    exports.normalizeStrategy = normalizeStrategy;
    function promiseInvokeOrFallbackOrNoop(object, method1, args1, method2, args2) {
        if (args2 === void 0) { args2 = []; }
        var method;
        try {
            method = object[method1];
        }
        catch (error) {
            return Promise_1.default.reject(error);
        }
        if (!method) {
            return promiseInvokeOrNoop(object, method2, args2);
        }
        if (!args1) {
            args1 = [];
        }
        try {
            return Promise_1.default.resolve(method.apply(object, args1));
        }
        catch (error) {
            return Promise_1.default.reject(error);
        }
    }
    exports.promiseInvokeOrFallbackOrNoop = promiseInvokeOrFallbackOrNoop;
    /**
     * Returns a promise that resolves the with result of the method call or undefined.
     */
    function promiseInvokeOrNoop(O, P, args) {
        if (args === void 0) { args = []; }
        var method;
        try {
            method = O[P];
        }
        catch (error) {
            return Promise_1.default.reject(error);
        }
        if (!method) {
            return Promise_1.default.resolve();
        }
        try {
            return Promise_1.default.resolve(method.apply(O, args));
        }
        catch (error) {
            return Promise_1.default.reject(error);
        }
    }
    exports.promiseInvokeOrNoop = promiseInvokeOrNoop;
});
//# sourceMappingURL=../_debug/streams/util.js.map