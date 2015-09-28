(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../../on', '../../Promise'], function (require, exports) {
    var on_1 = require('../../on');
    var Promise_1 = require('../../Promise');
    var EventedStreamSource = (function () {
        function EventedStreamSource(target, type) {
            this._target = target;
            if (Array.isArray(type)) {
                this._events = type;
            }
            else {
                this._events = [type];
            }
            this._handles = [];
        }
        EventedStreamSource.prototype.start = function (controller) {
            var _this = this;
            this._controller = controller;
            this._events.forEach(function (eventName) {
                _this._handles.push(on_1.default(_this._target, eventName, _this._handleEvent.bind(_this)));
            });
            return Promise_1.default.resolve();
        };
        EventedStreamSource.prototype.cancel = function (reason) {
            while (this._handles.length) {
                this._handles.shift().destroy();
            }
            return Promise_1.default.resolve();
        };
        EventedStreamSource.prototype._handleEvent = function (event) {
            this._controller.enqueue(event);
        };
        return EventedStreamSource;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = EventedStreamSource;
});
//# sourceMappingURL=../../_debug/streams/adapters/EventedStreamSource.js.map