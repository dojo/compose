(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports"], function (require, exports) {
    var QueuingStrategy = (function () {
        function QueuingStrategy(kwArgs) {
            this.highWaterMark = kwArgs.highWaterMark;
        }
        return QueuingStrategy;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = QueuingStrategy;
});
//# sourceMappingURL=../_debug/streams/QueuingStrategy.js.map