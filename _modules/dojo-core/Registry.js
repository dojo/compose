(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports"], function (require, exports) {
    /**
     * A registry of values tagged with matchers.
     */
    var Registry = (function () {
        /**
         * Construct a new Registry, optionally containing a given default value.
         */
        function Registry(defaultValue) {
            this._defaultValue = defaultValue;
            this._entries = [];
        }
        /**
         * Return the first entry in this registry that matches the given arguments. If no entry matches and the registry
         * was created with a default value, that value will be returned. Otherwise, an exception is thrown.
         *
         * @param ...args Arguments that will be used to select a matching value.
         * @returns the matching value, or a default value if one exists.
         */
        Registry.prototype.match = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i - 0] = arguments[_i];
            }
            var entries = this._entries.slice(0);
            var entry;
            for (var i = 0; (entry = entries[i]); ++i) {
                if (entry.test.apply(null, args)) {
                    return entry.value;
                }
            }
            if (this._defaultValue !== undefined) {
                return this._defaultValue;
            }
            throw new Error('No match found');
        };
        /**
         * Register a test + value pair with this registry.
         *
         * @param test The test that will be used to determine if the registered value matches a set of arguments.
         * @param value A value being registered.
         * @param first If true, the newly registered test and value will be the first entry in the registry.
         */
        Registry.prototype.register = function (test, value, first) {
            var entries = this._entries;
            var entry = {
                test: test,
                value: value
            };
            entries[(first ? 'unshift' : 'push')](entry);
            return {
                destroy: function () {
                    this.destroy = function () { };
                    var i = 0;
                    while ((i = entries.indexOf(entry, i)) > -1) {
                        entries.splice(i, 1);
                    }
                    test = value = entries = entry = null;
                }
            };
        };
        return Registry;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Registry;
});
//# sourceMappingURL=_debug/Registry.js.map