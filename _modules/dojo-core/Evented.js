(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './aspect'], function (require, exports) {
    var aspect_1 = require('./aspect');
    var Evented = (function () {
        function Evented() {
        }
        /**
         * Emits an event, firing listeners registered for it.
         * @param event The event object to emit
         */
        Evented.prototype.emit = function (data) {
            var type = '__on' + data.type;
            var method = this[type];
            if (method) {
                return method.call(this, data);
            }
        };
        /**
         * Listens for an event, calling the listener whenever the event fires.
         * @param type Event type to listen for
         * @param listener Callback to handle the event when it fires
         * @return A handle which will remove the listener when destroy is called
         */
        Evented.prototype.on = function (type, listener) {
            var name = '__on' + type;
            if (!this[name]) {
                Object.defineProperty(this, name, {
                    configurable: true,
                    value: undefined,
                    writable: true
                });
            }
            return aspect_1.on(this, '__on' + type, listener);
        };
        return Evented;
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Evented;
});
//# sourceMappingURL=_debug/Evented.js.map