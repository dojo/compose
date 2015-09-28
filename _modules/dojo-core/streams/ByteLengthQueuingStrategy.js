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
})(["require", "exports", './QueuingStrategy', './util'], function (require, exports) {
    var QueuingStrategy_1 = require('./QueuingStrategy');
    var util_1 = require('./util');
    var ByteLengthQueuingStrategy = (function (_super) {
        __extends(ByteLengthQueuingStrategy, _super);
        function ByteLengthQueuingStrategy() {
            _super.apply(this, arguments);
        }
        ByteLengthQueuingStrategy.prototype.size = function (chunk) {
            if (chunk.byteLength !== undefined) {
                return chunk.byteLength;
            }
            else {
                return util_1.getApproximateByteSize(chunk);
            }
        };
        return ByteLengthQueuingStrategy;
    })(QueuingStrategy_1.default);
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = ByteLengthQueuingStrategy;
});
//# sourceMappingURL=../_debug/streams/ByteLengthQueuingStrategy.js.map