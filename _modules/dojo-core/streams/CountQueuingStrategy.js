var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './QueuingStrategy'], function (require, exports) {
    var QueuingStrategy_1 = require('./QueuingStrategy');
    var CountQueuingStrategy = (function (_super) {
        __extends(CountQueuingStrategy, _super);
        function CountQueuingStrategy() {
            _super.apply(this, arguments);
        }
        CountQueuingStrategy.prototype.size = function (chunk) {
            return 1;
        };
        return CountQueuingStrategy;
    })(QueuingStrategy_1.default);
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = CountQueuingStrategy;
});
//# sourceMappingURL=../_debug/streams/CountQueuingStrategy.js.map