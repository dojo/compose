(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './has'], function (require, exports) {
    var has_1 = require('./has');
    function hasClass(feature, trueClass, falseClass) {
        return function (target) {
            return (has_1.default(feature) ? trueClass : falseClass);
        };
    }
    exports.hasClass = hasClass;
});
//# sourceMappingURL=_debug/decorators.js.map