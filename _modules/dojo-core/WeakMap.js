var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './decorators', './global'], function (require, exports) {
    var decorators_1 = require('./decorators');
    var global_1 = require('./global');
    var Shim;
    (function (Shim) {
        var DELETED = {};
        function getUID() {
            return Math.floor(Math.random() * 100000000);
        }
        var generateName = (function () {
            var startId = Math.floor(Date.now() % 100000000);
            return function generateName() {
                return '__wm' + getUID() + (startId++ + '__');
            };
        })();
        var WeakMap = (function () {
            function WeakMap(iterable) {
                Object.defineProperty(this, '_name', {
                    value: generateName()
                });
                if (iterable) {
                    for (var _i = 0; _i < iterable.length; _i++) {
                        var _a = iterable[_i], key = _a[0], value = _a[1];
                        this.set(key, value);
                    }
                }
            }
            WeakMap.prototype.delete = function (key) {
                var entry = key[this._name];
                if (entry && entry.key === key && entry.value !== DELETED) {
                    entry.value = DELETED;
                    return true;
                }
                return false;
            };
            WeakMap.prototype.get = function (key) {
                var entry = key[this._name];
                if (entry && entry.key === key && entry.value !== DELETED) {
                    return entry.value;
                }
            };
            WeakMap.prototype.has = function (key) {
                var entry = key[this._name];
                return Boolean(entry && entry.key === key && entry.value !== DELETED);
            };
            WeakMap.prototype.set = function (key, value) {
                if (!key || (typeof key !== 'object' && typeof key !== 'function')) {
                    throw new TypeError('Invalid value used as weak map key');
                }
                var entry = key[this._name];
                if (!entry || entry.key !== key) {
                    entry = Object.create(null, {
                        key: { value: key }
                    });
                    Object.defineProperty(key, this._name, {
                        value: entry
                    });
                }
                entry.value = value;
                return this;
            };
            return WeakMap;
        })();
        Shim.WeakMap = WeakMap;
    })(Shim || (Shim = {}));
    var WeakMap = (function () {
        /* istanbul ignore next */
        function WeakMap(iterable) {
        }
        /* istanbul ignore next */
        WeakMap.prototype.delete = function (key) { throw new Error(); };
        /* istanbul ignore next */
        WeakMap.prototype.get = function (key) { throw new Error(); };
        /* istanbul ignore next */
        WeakMap.prototype.has = function (key) { throw new Error(); };
        /* istanbul ignore next */
        WeakMap.prototype.set = function (key, value) { throw new Error(); };
        WeakMap = __decorate([
            decorators_1.hasClass('weakmap', global_1.default.WeakMap, Shim.WeakMap)
        ], WeakMap);
        return WeakMap;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = WeakMap;
});
//# sourceMappingURL=_debug/WeakMap.js.map