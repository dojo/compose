(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './global'], function (require, exports) {
    var global_1 = require('./global');
    exports.EPSILON = 1;
    exports.MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;
    exports.MIN_SAFE_INTEGER = -exports.MAX_SAFE_INTEGER;
    /**
     * Determines whether the passed value is NaN without coersion.
     *
     * @param value The value to test
     * @return true if the value is NaN, false if it is not
     */
    function isNaN(value) {
        return typeof value === 'number' && global_1.default.isNaN(value);
    }
    exports.isNaN = isNaN;
    /**
     * Determines whether the passed value is a finite number without coersion.
     *
     * @param value The value to test
     * @return true if the value is finite, false if it is not
     */
    function isFinite(value) {
        return typeof value === 'number' && global_1.default.isFinite(value);
    }
    exports.isFinite = isFinite;
    /**
     * Determines whether the passed value is an integer.
     *
     * @param value The value to test
     * @return true if the value is an integer, false if it is not
     */
    function isInteger(value) {
        return isFinite(value) && Math.floor(value) === value;
    }
    exports.isInteger = isInteger;
    /**
     * Determines whether the passed value is an integer that is 'safe,' meaning:
     *   1. it can be expressed as an IEEE-754 double precision number
     *   2. it has a one-to-one mapping to a mathematical integer, meaning its
     *      IEEE-754 representation cannot be the result of rounding any other
     *      integer to fit the IEEE-754 representation
     * @param value The value to test
     * @return true if the value is an integer, false if it is not
     */
    function isSafeInteger(value) {
        return isInteger(value) && Math.abs(value) <= exports.MAX_SAFE_INTEGER;
    }
    exports.isSafeInteger = isSafeInteger;
});
//# sourceMappingURL=_debug/number.js.map