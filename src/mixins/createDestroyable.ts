import { Handle } from 'dojo-core/interfaces';
import Promise from 'dojo-shim/Promise';
import WeakMap from 'dojo-shim/WeakMap';
import compose, { ComposeFactory } from '../compose';

export interface DestroyableOptions { }

export interface Destroyable {
	/**
	 * Take a handle and *own* it, which ensures that the handle's
	 * `destroy()` method is called when the *owner* is destroyed.
	 * @param handle The handle to own
	 * @returns A handle to *unown* the passed handle
	 */
	own(handle: Handle): Handle;

	/**
	 * Invoke `destroy()` on any owned handles.
	 * @returns A promise that resolves to `true` if successful, otherwise `false`
	 */
	destroy(): Promise<boolean>;
}

export interface DestroyableFactory extends ComposeFactory<Destroyable, DestroyableOptions> { }

/**
 * A reference to a function that always returns a promise which resolves to false
 */
const noop = function(): Promise<boolean> {
	return Promise.resolve(false);
};

/**
 * A reference to a function that throws, used to replace the `own()` method after
 * destruction
 */
const destroyed = function(): Handle {
	throw new Error('Call made to destroyed method');
};

/**
 * A weak map for *owning* handles on instances
 */
const handlesWeakMap = new WeakMap<Destroyable, Handle[]>();

/**
 * A type guard that determines if the value is a Destroyable
 * @param value The value to guard for
 */
export function isDestroyable(value: any): value is Destroyable {
	return Boolean(value && 'destroy' in value && typeof value.destroy === 'function');
}

/**
 * A mixin which adds the concepts of being able to *destroy* handles which the instance
 * *owns*
 */
const createDestroyable: DestroyableFactory = compose({
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
			const destroyable: Destroyable = this;
			handlesWeakMap.get(destroyable).forEach((handle) => {
				handle && handle.destroy && handle.destroy();
			});
			handlesWeakMap.delete(destroyable);
			destroyable.destroy = noop;
			destroyable.own = destroyed;
			resolve(true);
		});
	}
}, (instance) => {
	handlesWeakMap.set(instance, []);
});

export default createDestroyable;
