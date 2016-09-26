import { on } from 'dojo-core/aspect';
import { EventObject, Handle } from 'dojo-core/interfaces';
import Map from 'dojo-shim/Map';
import WeakMap from 'dojo-shim/WeakMap';
import compose, { ComposeFactory } from '../compose';
import createDestroyable, { Destroyable } from './createDestroyable';

export interface TargettedEventObject extends EventObject {
	/**
	 * The target of the event
	 */
	target: any;
}

export interface ActionableOptions<E extends TargettedEventObject> {
	[ option: string ]: any;
	/**
	 * An event object
	 */
	event?: E;
}

export interface Actionable<E extends TargettedEventObject> {
	/**
	 * The *do* method of an Action, which can take a `options` property of an `event`
	 *
	 * @param options Options passed which includes an `event` object
	 */
	do(options?: ActionableOptions<E>): any;
}

export interface EventedCallback<E extends EventObject> {
	/**
	 * A callback that takes an `event` argument
	 *
	 * @param event The event object
	 */
	(event: E): boolean | void;
}

/**
 * Either an `EventedCallback` or something that is `Actionable`
 */
export type EventedListener<E extends TargettedEventObject> = EventedCallback<E> | Actionable<E>;

/**
 * Either a single `EventedListener` or an array
 */
export type EventedListenerOrArray<E extends TargettedEventObject> = EventedListener<E> | EventedListener<E>[];

/**
 * A map of listeners where the key is the event `type`
 */
export interface EventedListenersMap {
	[type: string]: EventedListenerOrArray<TargettedEventObject>;
}

/**
 * A map of callbacks where the key is the event `type`
 */
type EventedCallbackMap = Map<string, EventedCallback<EventObject>>;

export interface EventedOptions {
	/**
	 * Any listeners that should be attached during construction
	 */
	listeners?: EventedListenersMap;
}

export interface EventedMixin {
	/**
	 * Emit an event.
	 *
	 * The event is determined by the `event.type`, if there are no listeners for an event type,
	 * `emit` is essentially a noop.
	 *
	 * @param event The `EventObject` to be delivered to listeners based on `event.type`
	 */
	emit<E extends EventObject>(event: E): void;

	/**
	 * Attach a `listener` to a particular event `type`.
	 *
	 * @param type The event to attach the listener to
	 * @param listener Either a function which takes an emitted `event` object, something that is `Actionable`,
	 *                 or an array of of such listeners.
	 * @returns A handle which can be used to remove the listener
	 */
	on(type: string, listener: EventedListenerOrArray<TargettedEventObject>): Handle;

	/**
	 * Attach a `listener` to a particular event `type`.
	 *
	 * @param type The event to attach the listener to
	 * @param listeners An object which contains key value pairs of event types and listeners.
	 */
	on(listeners: EventedListenersMap): Handle;
}

export type Evented = EventedMixin & Destroyable;

export interface EventedFactory extends ComposeFactory<Evented, EventedOptions> { }

/**
 * A weak map that contains a map of the listeners for an `Evented`
 */
const listenersMap = new WeakMap<Evented, EventedCallbackMap>();

/**
 * A guard which determines if the value is `Actionable`
 *
 * @param value The value to guard against
 */
function isActionable(value: any): value is Actionable<any> {
	return Boolean(value && typeof value.do === 'function');
}

/**
 * An internal function that always returns an EventedCallback
 *
 * @param listener Either a `EventedCallback` or an `Actionable`
 */
export function resolveListener<E extends TargettedEventObject>(listener: EventedListener<E>): EventedCallback<E> {
	return isActionable(listener) ? (event: E) => listener.do({ event }) : listener;
}

/**
 * Internal function to convert an array of handles to a single handle
 *
 * @param handles The array of handles to convert into a signle handle
 * @return The single handle
 */
function handlesArraytoHandle(handles: Handle[]): Handle {
	return {
		destroy() {
			handles.forEach((handle) => handle.destroy());
		}
	};
}

/**
 * Creates a new instance of an `Evented`
 */
const createEvented: EventedFactory = compose<EventedMixin, EventedOptions>({
		emit<E extends EventObject>(this: Evented, event: E): void {
			const method = listenersMap.get(this).get(event.type);
			if (method) {
				method.call(this, event);
			}
		},

		on(this: Evented, ...args: any[]): Handle {
			const listenerMap = listenersMap.get(this);
			if (args.length === 2) { /* overload: on(type, listener) */
				const [ type, listeners ] = <[ string, EventedListenerOrArray<TargettedEventObject>]> args;
				if (Array.isArray(listeners)) {
					const handles = listeners.map((listener) => on(listenerMap, type, resolveListener(listener)));
					return handlesArraytoHandle(handles);
				}
				else {
					return on(listenerMap, type, resolveListener(listeners));
				}
			}
			else if (args.length === 1) { /* overload: on(listeners) */
				const [ listenerMapArg ] = <[EventedListenersMap]> args;
				const handles = Object.keys(listenerMapArg).map((type) => this.on(type, listenerMapArg[type]));
				return handlesArraytoHandle(handles);
			}
			else { /* unexpected signature */
				throw new TypeError('Invalid arguments');
			}
		}
	})
	.mixin({
		className: 'Evented',
		mixin: createDestroyable,
		initialize(instance, options) {
			/* Initialise listener map */
			listenersMap.set(instance, new Map<string, EventedCallback<EventObject>>());

			if (options && options.listeners) {
				instance.own(instance.on(options.listeners));
			}
		}
	});

export default createEvented;
