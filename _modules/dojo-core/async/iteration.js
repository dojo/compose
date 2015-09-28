(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../Promise', '../array'], function (require, exports) {
    var Promise_1 = require('../Promise');
    var array = require('../array');
    /**
     * Processes all items and then applies the callback to each item and eventually returns an object containing the
     * processed values and callback results
     * @param items a list of synchronous/asynchronous values to process
     * @param callback a callback that maps values to synchronous/asynchronous results
     * @return a list of objects holding the synchronous values and synchronous results.
     */
    function processValuesAndCallback(items, callback) {
        return Promise_1.default.all(items)
            .then(function (results) {
            var pass = Array.prototype.map.call(results, callback);
            return Promise_1.default.all(pass)
                .then(function (pass) {
                return { values: results, results: pass };
            });
        });
    }
    /**
     * Finds the index of the next value in a sparse array-like object
     * @param list the sparse array-like object
     * @param offset the starting offset
     * @return {number} the offset of the next index with a value; or -1 if not found
     */
    function findNextValueIndex(list, offset) {
        if (offset === void 0) { offset = -1; }
        offset++;
        for (var length_1 = list.length; offset < length_1; offset++) {
            if (offset in list) {
                return offset;
            }
        }
        return -1;
    }
    function findLastValueIndex(list, offset) {
        offset = (offset === undefined ? list.length : offset) - 1;
        for (; offset >= 0; offset--) {
            if (offset in list) {
                return offset;
            }
        }
        return -1;
    }
    function generalReduce(findNextIndex, items, callback, initialValue) {
        var hasInitialValue = arguments.length > 3;
        return Promise_1.default.all(items)
            .then(function (results) {
            return new Promise_1.default(function (resolve, reject) {
                var i;
                function next(currentValue) {
                    i = findNextIndex(items, i);
                    if (i >= 0) {
                        var result = callback(currentValue, results[i], i, results);
                        if (result.then) {
                            result.then(next, reject);
                        }
                        else {
                            next(result);
                        }
                    }
                    else {
                        resolve(currentValue);
                    }
                }
                ;
                var value;
                if (hasInitialValue) {
                    value = initialValue;
                }
                else {
                    i = findNextIndex(items);
                    if (i < 0) {
                        throw new Error('reduce array with no initial value');
                    }
                    value = results[i];
                }
                next(value);
            });
        });
    }
    function testAndHaltOnCondition(condition, items, callback) {
        return Promise_1.default.all(items).then(function (results) {
            return new Promise_1.default(function (resolve) {
                var result;
                var pendingCount = 0;
                for (var i = 0; i < results.length; i++) {
                    result = callback(results[i], i, results);
                    if (result === condition) {
                        return resolve(result);
                    }
                    else if (result.then) {
                        pendingCount++;
                        result.then(function (result) {
                            if (result === condition) {
                                resolve(result);
                            }
                            pendingCount--;
                            if (pendingCount === 0) {
                                resolve(!condition);
                            }
                        });
                    }
                }
                if (pendingCount === 0) {
                    resolve(!condition);
                }
            });
        });
    }
    /**
     * Test whether all elements in the array pass the provided callback
     * @param items a collection of synchronous/asynchronous values
     * @param callback a synchronous/asynchronous test
     * @return eventually returns true if all values pass; otherwise false
     */
    function every(items, callback) {
        return testAndHaltOnCondition(false, items, callback);
    }
    exports.every = every;
    /**
     * Returns an array of elements which pass the provided callback
     * @param items a collection of synchronous/asynchronous values
     * @param callback a synchronous/asynchronous test
     * @return eventually returns a new array with only values that have passed
     */
    function filter(items, callback) {
        return processValuesAndCallback(items, callback).then(function (_a) {
            var results = _a.results, values = _a.values;
            var arr = [];
            for (var i = 0; i < results.length; i++) {
                results[i] && arr.push(values[i]);
            }
            return arr;
        });
    }
    exports.filter = filter;
    /**
     * Find the first value matching a filter function
     * @param items a collection of synchronous/asynchronous values
     * @param callback a synchronous/asynchronous test
     * @return a promise eventually containing the item or undefined if a match is not found
     */
    function find(items, callback) {
        return findIndex(items, callback).then(function (i) {
            return i >= 0 ? items[i] : undefined;
        });
    }
    exports.find = find;
    /**
     * Find the first index with a value matching the filter function
     * @param items a collection of synchronous/asynchronous values
     * @param callback a synchronous/asynchronous test
     * @return a promise eventually containing the index of the matching item or -1 if a match is not found
     */
    function findIndex(items, callback) {
        // TODO we can improve this by returning immediately
        return processValuesAndCallback(items, callback).then(function (_a) {
            var results = _a.results;
            for (var i = 0; i < results.length; i++) {
                if (results[i]) {
                    return i;
                }
            }
            return -1;
        });
    }
    exports.findIndex = findIndex;
    /**
     * transform a list of items using a mapper function
     * @param items a collection of synchronous/asynchronous values
     * @param callback a synchronous/asynchronous transform function
     * @return a promise eventually containing a collection of each transformed value
     */
    function map(items, callback) {
        return processValuesAndCallback(items, callback)
            .then(function (_a) {
            var results = _a.results;
            return results;
        });
    }
    exports.map = map;
    /**
     * reduce a list of items down to a single value
     * @param items a collection of synchronous/asynchronous values
     * @param callback a synchronous/asynchronous reducer function
     * @param [initialValue] the first value to pass to the callback
     * @return a promise eventually containing a value that is the result of the reduction
     */
    function reduce(items, callback, initialValue) {
        var args = array.from(arguments);
        args.unshift(findNextValueIndex);
        return generalReduce.apply(this, args);
    }
    exports.reduce = reduce;
    function reduceRight(items, callback, initialValue) {
        var args = array.from(arguments);
        args.unshift(findLastValueIndex);
        return generalReduce.apply(this, args);
    }
    exports.reduceRight = reduceRight;
    function series(items, operation) {
        return generalReduce(findNextValueIndex, items, function (previousValue, currentValue, index, array) {
            var result = operation(currentValue, index, array);
            if (result.then) {
                return result.then(function (value) {
                    previousValue.push(value);
                    return previousValue;
                });
            }
            previousValue.push(result);
            return previousValue;
        }, []);
    }
    exports.series = series;
    function some(items, callback) {
        return testAndHaltOnCondition(true, items, callback);
    }
    exports.some = some;
});
//# sourceMappingURL=../_debug/async/iteration.js.map