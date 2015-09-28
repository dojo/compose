(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './object'], function (require, exports) {
    var object_1 = require('./object');
    /**
     * An implementation analogous to the Map specification in ES2015,
     * with the exception of iterators.  The entries, keys, and values methods
     * are omitted, since forEach essentially provides the same functionality.
     */
    var Map = (function () {
        /**
         * Creates a new Map
         *
         * @constructor
         *
         * @param arrayLike
         * Array or array-like object containing two-item tuples used to initially populate the map.
         * The first item in each tuple corresponds to the key of the map entry.
         * The second item corresponds to the value of the map entry.
         */
        function Map(arrayLike) {
            this._keys = [];
            this._values = [];
            if (arrayLike) {
                for (var i = 0, length_1 = arrayLike.length; i < length_1; i++) {
                    this.set(arrayLike[i][0], arrayLike[i][1]);
                }
            }
        }
        /*
         * An alternative to Array.prototype.indexOf using Object.is
         * to check for equality. See http://mzl.la/1zuKO2V
         */
        Map.prototype._indexOfKey = function (keys, key) {
            for (var i = 0, length_2 = keys.length; i < length_2; i++) {
                if (object_1.is(keys[i], key)) {
                    return i;
                }
            }
            return -1;
        };
        Object.defineProperty(Map.prototype, "size", {
            /**
             * Returns the number of key / value pairs in the Map.
             *
             * @return the number of key / value pairs in the Map
             */
            get: function () {
                return this._keys.length;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Deletes all keys and their associated values.
         */
        Map.prototype.clear = function () {
            this._keys.length = this._values.length = 0;
        };
        /**
         * Deletes a given key and its associated value.
         *
         * @param key The key to delete
         * @return true if the key exists, false if it does not
         */
        Map.prototype.delete = function (key) {
            var index = this._indexOfKey(this._keys, key);
            if (index < 0) {
                return false;
            }
            this._keys.splice(index, 1);
            this._values.splice(index, 1);
            return true;
        };
        /**
         * Executes a given function for each map entry. The function
         * is invoked with three arguments: the element value, the
         * element key, and the associated Map instance.
         *
         * @param callback The function to execute for each map entry,
         * @param context The value to use for `this` for each execution of the calback
         */
        Map.prototype.forEach = function (callback, context) {
            var keys = this._keys;
            var values = this._values;
            for (var i = 0, length_3 = keys.length; i < length_3; i++) {
                callback.call(context, values[i], keys[i], this);
            }
        };
        /**
         * Returns the value associated with a given key.
         *
         * @param key The key to look up
         * @return The value if one exists or undefined
         */
        Map.prototype.get = function (key) {
            var index = this._indexOfKey(this._keys, key);
            return index < 0 ? undefined : this._values[index];
        };
        /**
         * Checks for the presence of a given key.
         *
         * @param key The key to check for
         * @return true if the key exists, false if it does not
         */
        Map.prototype.has = function (key) {
            return this._indexOfKey(this._keys, key) > -1;
        };
        /**
         * Sets the value associated with a given key.
         *
         * @param key The key to define a value to
         * @param value The value to assign
         * @return The Map instance
         */
        Map.prototype.set = function (key, value) {
            var index = this._indexOfKey(this._keys, key);
            index = index < 0 ? this._keys.length : index;
            this._keys[index] = key;
            this._values[index] = value;
            return this;
        };
        return Map;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Map;
});
//# sourceMappingURL=_debug/Map.js.map