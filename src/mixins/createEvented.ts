import { on } from 'dojo-core/aspect';
import { EventObject, Handle } from 'dojo-core/interfaces';
import WeakMap from 'dojo-core/WeakMap';
import compose, { ComposeFactory } from '../compose';
import createDestroyable, { Destroyable } from './createDestroyable';

export interface ActionableOptions<E extends EventObject> {
	[ option: string ]: any;
	/**
	 * An event object
	 */
	event: E;
}

export interface Actionable<E extends EventObject> {
	/**
	 * The *do* method of an Action, which can take a `options` property of an `event`
	 * @param options Options passed which includes an `event` object
	 */
	do(options?: ActionableOptions<E>): any;
}

export interface EventedCallback<E extends EventObject> {
	/**
	 * A callback that takes an `event` argument
	 * @param event The event object
	 */
	(event: E): boolean | void;
}

/**
 * Either an `EventedCallback` or something that is `Actionable`
 */
export type EventedListener<E extends EventObject> = EventedCallback<E> | Actionable<E>;

/**
 * A map of listeners where the key is the event `type`
 */
export interface EventedListenersMap {
	[type: string]: EventedListener<EventObject>;
}

/**
 * A map of callbacks where the key is the event `type`
 */
interface EventedCallbackMap {
	[type: string]: EventedCallback<EventObject>;
}

export interface EventedOptions {
	/**
	 * Any listeners that should be attached during construction
	 */
	listeners?: EventedListenersMap;
}

export interface Evented extends Destroyable {
	/**
	 * Emit an event.
	 *
	 * The event is determined by the `event.type`, if there are no listeners for an event type,
	 * `emit` is essentially a noop.
	 * @param event The `EventObject` to be delivered to listeners based on `event.type`
	 */
	emit<E extends EventObject>(event: E): void;

	/**
	 * Attach a `listener` to a particular event `type`.
	 *
	 * @param type The event to attach the listener to
	 * @param listener Either a function which takes an emitted `event` object, or something that is `Actionable`
	 * @returns A handle which can be used to remove the listener
	 */
	on(type: string, listener: EventedListener<EventObject>): Handle;
}

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
function isActionable<E extends EventObject>(value: any): value is Actionable<E> {
	return Boolean(value && 'do' in value && typeof value.do === 'function');
}

/**
 * An internal function that always returns an EventedCallback
 * @param listener Either a `EventedCallback` or an `Actionable`
 */
export function resolveListener<E extends EventObject>(listener: EventedListener<E>): EventedCallback<E> {
	return isActionable(listener) ? function (event: E) {
			listener.do({ event });
		} : listener;
}

/**
 * Creates a new instance of an `Evented`
 */
const createEvented: EventedFactory = compose({
		emit<E extends EventObject>(event: E): void {
			const method = listenersMap.get(this)[event.type];
			if (method) {
				method.call(this, event);
			}
		},
		on(type: string, listener: EventedListener<Event>): Handle {
			return on(listenersMap.get(this), type, resolveListener(listener));
		}
	})
	.mixin({
		mixin: createDestroyable,
		initialize(instance: Evented, options: EventedOptions) {
			/* Initialise listener map */
			listenersMap.set(instance, {});

			if (options && 'listeners' in options) {
				for (let eventType in options.listeners) {
					instance.own(instance.on(eventType, options.listeners[eventType]));
				}
			}
		}
	});

export default createEvented;
