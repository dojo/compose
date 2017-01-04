import { on } from 'dojo-core/aspect';
import {
	EventObject,
	EventTargettedObject,
	Handle
} from 'dojo-interfaces/core';
import {
	Evented,
	EventedOptions,
	EventedListener,
	EventedListenerOrArray,
	EventedListenersMap,
	EventedCallback
} from 'dojo-interfaces/bases';
import { Actionable } from 'dojo-interfaces/abilities';
import Map from 'dojo-shim/Map';
import WeakMap from 'dojo-shim/WeakMap';
import { ComposeFactory } from '../compose';
import createDestroyable from './createDestroyable';

/**
 * A map of callbacks where the key is the event `type`
 */
type EventedCallbackMap = Map<string, EventedCallback<EventObject>>;

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
function isActionable(value: any): value is Actionable<any, any> {
	return Boolean(value && typeof value.do === 'function');
}

/**
 * An internal function that always returns an EventedCallback
 *
 * @param listener Either a `EventedCallback` or an `Actionable`
 */
export function resolveListener<T, E extends EventTargettedObject<T>>(listener: EventedListener<T, E>): EventedCallback<E> {
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
 * Internal function to check if a target string matches a glob string that contains wildcards.
 * Note: Due to limited use cases in event type name, currently only `*` that matches 0 or more characters is supported.
 *
 * @param globString The glob string that contains wildcards pattern
 * @param targetString The string under test
 * @return boolean match result
 */

function isGlobMatch(globString: string, targetString: string): boolean {
	if (!globString || !targetString) {
		return false;
	}
	const regex = new RegExp(`^${ globString.replace(/\*/g, '.*') }$`);

	if (regex.test(targetString)) {
		return true;
	}
	return false;
}

/**
 * Creates a new instance of an `Evented`
 */
const createEvented: EventedFactory = createDestroyable
	.mixin({
		className: 'Evented',
		mixin: {
			emit<E extends EventObject>(this: Evented, event: E): void {
				listenersMap.get(this).forEach((method, type) => {
					if (isGlobMatch(type, event.type)) {
						method.call(this, event);
					}
				});
			},

			on(this: Evented, ...args: any[]): Handle {
				const listenerMap = listenersMap.get(this);
				if (args.length === 2) { /* overload: on(type, listener) */
					const [ type, listeners ] = <[ string, EventedListenerOrArray<any, EventTargettedObject<any>>]> args;
					if (Array.isArray(listeners)) {
						const handles = listeners.map((listener) => on(listenerMap, type, resolveListener(listener)));
						return handlesArraytoHandle(handles);
					}
					else {
						return on(listenerMap, type, resolveListener(listeners));
					}
				}
				else if (args.length === 1) { /* overload: on(listeners) */
					const [ listenerMapArg ] = <[EventedListenersMap<any>]> args;
					const handles = Object.keys(listenerMapArg).map((type) => this.on(type, listenerMapArg[type]));
					return handlesArraytoHandle(handles);
				}
				else { /* unexpected signature */
					throw new TypeError('Invalid arguments');
				}
			}
		},
		initialize(instance: Evented, options: EventedOptions) {
			listenersMap.set(instance, new Map<string, EventedCallback<EventObject>>());
			if (options && options.listeners) {
				instance.own(instance.on(options.listeners));
			}
		}
	});

export default createEvented;
