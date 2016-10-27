import { EventCancelableObject } from 'dojo-interfaces/core';

/**
 * A simple factory that creates an event object which can be cancelled
 *
 * @param options The options for the event
 */
function createCancelableEvent<T extends string, U>(options: { type: T, target: U }): EventCancelableObject<T, U> {
	const { type, target } = options;
	const event = Object.defineProperties({}, {
		type: { value: type, enumerable: true },
		target: { value: target, enumerable: true },
		cancelable: { value: true, enumerable: true },
		defaultPrevented: { value: false, enumerable: true, configurable: true },
		preventDefault: { value() {
			Object.defineProperty(event, 'defaultPrevented', { value: true, enumerable: true });
		}, enumerable: true }
	});

	return event;
}

export default createCancelableEvent;
