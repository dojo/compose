import { on } from '@dojo/core/aspect';
import {
	EventObject,
	EventTargettedObject,
	Handle
} from '@dojo/interfaces/core';
import {
	Evented,
	EventedOptions,
	EventedListener,
	EventedListenerOrArray,
	EventedListenersMap,
	EventedCallback, Destroyable
} from '@dojo/interfaces/bases';
import { Actionable } from '@dojo/interfaces/abilities';
import Map from '@dojo/shim/Map';
import WeakMap from '@dojo/shim/WeakMap';
import { ComposeCreatedMixin } from '../compose';
import destroyableMixin from './destroyableMixin';

/**
 * A map of callbacks where the key is the event `type`
 */
type EventedCallbackMap = Map<string, EventedCallback<EventObject>>;

export interface EventedMixin extends ComposeCreatedMixin<{}, Evented & Destroyable, EventedOptions, {}> { }

/**
 * A weak map that contains a map of the listeners for an `Evented`
 */
const listenersMap = new WeakMap<Evented, EventedCallbackMap>();

/**
 * A map that contains event type names that contain wildcards and their RegExp mapping
 */
const regexMap = new Map<string, RegExp>();

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
	if (globString.indexOf('*') !== -1) {
		let regex: RegExp;
		if (regexMap.has(globString)) {
			regex = regexMap.get(globString)!;
		}
		else {
			regex = new RegExp(`^${ globString.replace(/\*/g, '.*') }$`);
			regexMap.set(globString, regex);
		}
		return regex.test(targetString);

	} else {
		return globString === targetString;
	}
}

/**
 * Creates a new instance of an `Evented`
 */
const eventedMixin: EventedMixin = destroyableMixin
	.extend('Evented', {
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
	})
	.init((instance, options?: EventedOptions) => {
		listenersMap.set(instance, new Map<string, EventedCallback<EventObject>>());
		if (options && options.listeners) {
			instance.own(instance.on(options.listeners));
		}
	});

export default eventedMixin;
