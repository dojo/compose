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
})(["require", "exports", '../has', '../object', '../queue', '../Scheduler'], function (require, exports) {
    var has_1 = require('../has');
    var object_1 = require('../object');
    var queue_1 = require('../queue');
    var Scheduler_1 = require('../Scheduler');
    has_1.add('object-observe', typeof Object.observe === 'function');
    var BaseObjectObserver = (function () {
        function BaseObjectObserver(kwArgs) {
            this._listener = kwArgs.listener;
            this._propertyStore = {};
            this._target = kwArgs.target;
        }
        return BaseObjectObserver;
    })();
    exports.BaseObjectObserver = BaseObjectObserver;
    var Es7Observer = (function (_super) {
        __extends(Es7Observer, _super);
        /**
         * Creates a new Es7Observer that uses `Object.observe` to watch and notify listeners of changes.
         *
         * Requires a native `Object.observe` implementation.
         *
         * @constructor
         *
         * @param kwArgs
         * The `kwArgs` object is expected to contain the target object to observe and the callback
         * that will be fired when changes occur.
         */
        function Es7Observer(kwArgs) {
            _super.call(this, kwArgs);
            this.onlyReportObserved = ('onlyReportObserved' in kwArgs) ? kwArgs.onlyReportObserved : true;
            this._setObserver();
        }
        /**
         * Initializes observation on the underlying object, preventing multiple changes to the same
         * property from emitting multiple notifications.
         */
        Es7Observer.prototype._setObserver = function () {
            var store = this._propertyStore;
            var target = this._target;
            this._observeHandler = function (changes) {
                var propertyMap = {};
                var events = changes.reduce(function (events, change) {
                    var property = change.name;
                    if (!this.onlyReportObserved || (property in store)) {
                        if (property in propertyMap) {
                            events.splice(propertyMap[property], 1);
                        }
                        propertyMap[property] = events.length;
                        events.push({
                            target: target,
                            name: property
                        });
                    }
                    return events;
                }.bind(this), []);
                if (events.length) {
                    this._listener(events);
                }
            }.bind(this);
            Object.observe(target, this._observeHandler);
        };
        /**
         * Ends all notifications on the target.
         */
        Es7Observer.prototype.destroy = function () {
            var target = this._target;
            Object.unobserve(target, this._observeHandler);
            this._listener = this._observeHandler = this._propertyStore = this._target = null;
        };
        /**
         * Enables notifications for the given property (or properties).
         *
         * If the `onlyReportObserved` option is `false`, then adding new properties will have no effect until
         * `onlyReportObserved` is reset to `true`.
         *
         * @param properties The property name or arguments list of property names that will be observed.
         */
        Es7Observer.prototype.observeProperty = function () {
            var properties = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                properties[_i - 0] = arguments[_i];
            }
            var store = this._propertyStore;
            properties.forEach(function (property) {
                store[property] = 1;
            });
        };
        /**
         * Disables notifications for the given property (or properties).
         *
         * If the `onlyReportObserved` option is `false`, then removing properties will have no effect until
         * `onlyReportObserved` is reset to `true`.
         *
         * * @param properties The property name or arguments list of property names that will be removed.
         */
        Es7Observer.prototype.removeProperty = function () {
            var properties = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                properties[_i - 0] = arguments[_i];
            }
            var store = this._propertyStore;
            properties.forEach(function (property) {
                // Since the store is just a simple map, using the `delete` operator is not problematic.
                delete store[property];
            });
        };
        return Es7Observer;
    })(BaseObjectObserver);
    exports.Es7Observer = Es7Observer;
    /**
     * In environments with no native `Object.observe` implementation, the notification system involves
     * swapping out the underlying setters for observed properties with a setter that fires a registered
     * callback. In order to properly unobserve properties, it is necessary to retrieve the original property
     * descriptors, own or inherited. Since it is possible to observe properties that do not yet exist, a
     * default descriptor can be returned. This default descriptor is the same as that generated by simple
     * `object.property = value` operations.
     */
    function getPropertyDescriptor(target, property) {
        var descriptor;
        if (!(property in target)) {
            return {
                enumerable: true,
                configurable: true,
                writable: true
            };
        }
        do {
            descriptor = Object.getOwnPropertyDescriptor(target, property);
        } while (!descriptor && (target = Object.getPrototypeOf(target)));
        return descriptor;
    }
    var Es5Observer = (function (_super) {
        __extends(Es5Observer, _super);
        /**
         * Creates a new Es5Observer to watch and notify listeners of changes.
         *
         * This should only be used when 1) there is no native `Object.observe` implementation or 2) notifications
         * should be fired immediately rather than queued.
         *
         * @constructor
         *
         * @param kwArgs
         * The `kwArgs` object is expected to contain the target object to observe and the callback
         * that will be fired when changes occur.
         */
        function Es5Observer(kwArgs) {
            _super.call(this, kwArgs);
            if (!this.constructor._scheduler) {
                this.constructor._scheduler = new Scheduler_1.default({ queueFunction: queue_1.queueMicroTask });
            }
            this.nextTurn = ('nextTurn' in kwArgs) ? kwArgs.nextTurn : true;
            this._descriptors = {};
            this._scheduler = this.constructor._scheduler;
            this._boundDispatch = this._dispatch.bind(this);
        }
        Es5Observer.prototype._dispatch = function () {
            var queue = this._currentlyScheduled;
            var events = Object.keys(queue).map(function (property) {
                return queue[property];
            });
            this._currentlyScheduled = null;
            this._listener(events);
        };
        Es5Observer.prototype._restore = function (property) {
            var target = this._target;
            var store = this._propertyStore;
            Object.defineProperty(target, property, (this._descriptors[property] || {
                configurable: true,
                enumerable: true,
                value: target[property],
                writable: true
            }));
            target[property] = store[property];
        };
        Es5Observer.prototype._schedule = function (property) {
            var event = {
                target: this._target,
                name: property
            };
            if (this.nextTurn) {
                if (!this._currentlyScheduled) {
                    this._currentlyScheduled = {};
                    this._scheduler.schedule(this._boundDispatch);
                }
                this._currentlyScheduled[property] = event;
            }
            else {
                this._listener([event]);
            }
        };
        /**
         * Ends all notifications on the target, restoring it to its original state.
         */
        Es5Observer.prototype.destroy = function () {
            var descriptors = this._descriptors;
            Object.keys(descriptors).forEach(this._restore, this);
            this._descriptors = this._listener = this._propertyStore = this._target = null;
        };
        /**
         * Enables notifications for the given property (or properties).
         *
         * @param properties The property name or arguments list of property names that will be observed.
         */
        Es5Observer.prototype.observeProperty = function () {
            var properties = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                properties[_i - 0] = arguments[_i];
            }
            var target = this._target;
            var store = this._propertyStore;
            var self = this;
            properties.forEach(function (property) {
                var descriptor = getPropertyDescriptor(target, property);
                if (descriptor.writable) {
                    var observableDescriptor = {
                        configurable: descriptor ? descriptor.configurable : true,
                        enumerable: descriptor ? descriptor.enumerable : true,
                        get: function () {
                            return store[property];
                        },
                        set: function (value) {
                            var previous = store[property];
                            if (!object_1.is(value, previous)) {
                                store[property] = value;
                                self._schedule(property);
                            }
                        }
                    };
                    store[property] = target[property];
                    self._descriptors[property] = descriptor;
                    Object.defineProperty(target, property, observableDescriptor);
                }
            });
        };
        /**
         * Disables notifications for the given property (or properties).
         *
         * @param properties The property name or arguments list of property names that will be removed.
         */
        Es5Observer.prototype.removeProperty = function () {
            var properties = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                properties[_i - 0] = arguments[_i];
            }
            var store = this._propertyStore;
            properties.forEach(function (property) {
                this._restore(property);
                // Since the store is just a simple map, using the `delete` operator is not problematic.
                delete store[property];
            }, this);
        };
        return Es5Observer;
    })(BaseObjectObserver);
    exports.Es5Observer = Es5Observer;
});
//# sourceMappingURL=../_debug/observers/ObjectObserver.js.map