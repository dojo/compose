import { Destroyable } from 'dojo-interfaces/bases';
import { Handle } from 'dojo-interfaces/core';
import Promise from 'dojo-shim/Promise';
import WeakMap from 'dojo-shim/WeakMap';
import compose, { ComposeFactory } from '../compose';

export interface DestroyableFactory extends ComposeFactory<Destroyable, {}> { }

/**
 * A reference to a function that always returns a promise which resolves to false
 */
function noop(): Promise<boolean> {
	return Promise.resolve(false);
};

/**
 * A reference to a function that throws, used to replace the `own()` method after
 * destruction
 */
function destroyed(): never {
	throw new Error('Call made to destroyed method');
};

/**
 * A weak map for *owning* handles on instances
 */
const handlesWeakMap = new WeakMap<Destroyable, Handle[]>();

/**
 * A type guard that determines if the value is a Destroyable
 *
 * @param value The value to guard for
 */
export function isDestroyable(value: any): value is Destroyable {
	return Boolean(value && 'destroy' in value && typeof value.destroy === 'function');
}

/**
 * A mixin which adds the concepts of being able to *destroy* handles which the instance
 * *owns*
 */
const createDestroyable: DestroyableFactory = compose('Destroyable', {
	own(this: Destroyable, handle: Handle): Handle {
		const handles = handlesWeakMap.get(this);
		handles.push(handle);
		return {
			destroy() {
				handles.splice(handles.indexOf(handle));
				handle.destroy();
			}
		};
	},

	destroy(this: Destroyable) {
		return new Promise((resolve) => {
			handlesWeakMap.get(this).forEach((handle) => {
				handle && handle.destroy && handle.destroy();
			});
			this.destroy = noop;
			this.own = destroyed;
			resolve(true);
		});
	}
}, (instance) => {
	handlesWeakMap.set(instance, []);
});

export default createDestroyable;
