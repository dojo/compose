(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports"], function (require, exports) {
    var globalObject = (function () {
        return this;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = globalObject;
});
//# sourceMappingURL=_debug/global.js.map