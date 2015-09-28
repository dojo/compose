(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './global'], function (require, exports) {
    var global_1 = require('./global');
    exports.cache = Object.create(null);
    var testFunctions = Object.create(null);
    /**
     * Register a new test for a named feature.
     *
     * @example
     * has.add('dom-addeventlistener', !!document.addEventListener);
     *
     * @example
     * has.add('touch-events', function () {
     *    return 'ontouchstart' in document
     * });
     */
    function add(feature, value, overwrite) {
        if (overwrite === void 0) { overwrite = false; }
        if ((feature in exports.cache || feature in testFunctions) && !overwrite) {
            return;
        }
        if (typeof value === 'function') {
            testFunctions[feature] = value;
        }
        else {
            exports.cache[feature] = value;
        }
    }
    exports.add = add;
    /**
     * Return the current value of a named feature.
     *
     * @param feature The name (if a string) or identifier (if an integer) of the feature to test.
     * @return The value of a given feature test
     */
    function has(feature) {
        var result;
        if (testFunctions[feature]) {
            result = exports.cache[feature] = testFunctions[feature].call(null);
            testFunctions[feature] = null;
        }
        else {
            result = exports.cache[feature];
        }
        return result;
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = has;
    /*
     * OOTB feature tests
     */
    add('host-browser', typeof document !== 'undefined' && typeof location !== 'undefined');
    add('host-node', function () {
        if (typeof process === 'object' && process.versions && process.versions.node) {
            return process.versions.node;
        }
    });
    add('float32array', 'Float32Array' in global_1.default);
    add('setimmediate', typeof global_1.default.setImmediate !== 'undefined');
    add('dom-mutationobserver', function () {
        return has('host-browser') && Boolean(global_1.default.MutationObserver || global_1.default.WebKitMutationObserver);
    });
    add('microtasks', function () {
        return has('promise') || has('host-node') || has('dom-mutationobserver');
    });
    add('object-assign', typeof Object.assign === 'function');
    add('object-observe', typeof Object.observe === 'function');
    add('postmessage', typeof postMessage === 'function');
    add('promise', typeof global_1.default.Promise !== 'undefined');
    add('raf', typeof requestAnimationFrame === 'function');
    add('weakmap', function () {
        if (typeof global_1.default.WeakMap !== 'undefined') {
            var key1 = {};
            var key2 = {};
            var map = new global_1.default.WeakMap([[key1, 1]]);
            return map.get(key1) === 1 && map.set(key2, 2) === map;
        }
        return false;
    });
    add('formdata', typeof global_1.default.FormData !== 'undefined');
    add('xhr', typeof global_1.default.XMLHttpRequest !== 'undefined');
    add('xhr2', has('xhr') && 'responseType' in global_1.default.XMLHttpRequest.prototype);
    add('xhr2-blob', function () {
        if (!has('xhr2')) {
            return false;
        }
        var request = new XMLHttpRequest();
        request.open('GET', '/', true);
        request.responseType = 'blob';
        request.abort();
        return request.responseType === 'blob';
    });
});
//# sourceMappingURL=_debug/has.js.map