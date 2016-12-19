import { deepAssign } from 'dojo-core/lang';
import { Handle } from 'dojo-interfaces/core';
import {
	Evented,
	Stateful,
	StatefulOptions,
	StatefulMixin
} from 'dojo-interfaces/bases';
import { StoreObservablePatchable } from 'dojo-interfaces/abilities';
import { Subscription } from 'dojo-shim/Observable';
import WeakMap from 'dojo-shim/WeakMap';
import createEvented from './createEvented';
import { ComposeFactory } from '../compose';
import createCancelableEvent from './createCancelableEvent';

export interface StatefulFactory extends ComposeFactory<Stateful<Object>, StatefulOptions<Object>> {
	<S extends Object>(options?: StatefulOptions<S>): Stateful<S>;
}

/**
 * Internal interface which contains references to an observed state
 */
interface ObservedState {
	id: string;
	observable: StoreObservablePatchable<Object>;
	subscription: Subscription;
	handle: Handle;
}

/**
 * A weak map of stateful instances to their obseved state references
 */
const observedStateMap = new WeakMap<Stateful<Object>, ObservedState>();

/**
 * Internal function to unobserve the state of a `Stateful`.  It emits a `statecomplete` event which can be
 * cancelled.
 *
 * @param stateful The `Stateful` object to unobserve
 */
function completeStatefulState(stateful: Stateful<Object>): void {
	const observedState = observedStateMap.get(stateful);
	if (observedState) {
		observedState.handle.destroy();
		const statecomplete = createCancelableEvent({
			type: 'state:completed',
			target: stateful
		});
		stateful.emit(statecomplete);
		if (!statecomplete.defaultPrevented) {
			stateful.destroy();
		}
	}
}

/**
 * Internal function that actually applies the state to the Stateful's state and
 * emits the `statechange` event.
 *
 * @param stateful The Stateful instance
 * @param state The State to be set
 */
function setStatefulState(target: Stateful<Object>, state: Object): void {
	const previousState = stateWeakMap.get(target);
	if (!previousState) {
		throw new Error('Unable to set destroyed state');
	}
	const type = 'state:changed';
	state = deepAssign(previousState, state);
	const eventObject = {
		type,
		state,
		target
	};
	target.emit(eventObject);
}

/**
 * A weak map that contains the stateful's state
 */
const stateWeakMap = new WeakMap<Stateful<Object>, Object>();

/**
 * Create an instance of a stateful object
 */
const createStateful: StatefulFactory = createEvented
	.mixin({
		className: 'Stateful',
		mixin: {
			get stateFrom(this: Stateful<Object>): StoreObservablePatchable<Object> | undefined {
				const observedState = observedStateMap.get(this);
				if (observedState) {
					return observedState.observable;
				}
			},

			get state(this: Stateful<Object>): Object {
				return stateWeakMap.get(this);
			},

			setState(this: Stateful<Object>, value: Object) {
				const observedState = observedStateMap.get(this);
				if (observedState) {
					observedState.observable.patch(value, { id: observedState.id });
				}
				else {
					setStatefulState(this, value);
				}
			},

			observeState(this: Stateful<Object>, id: string, observable: StoreObservablePatchable<Object>): Handle {
				let observedState = observedStateMap.get(this);
				if (observedState) {
					if (observedState.id === id && observedState.observable === observable) {
						return observedState.handle;
					}
					throw new Error(`Already observing state with ID '${observedState.id}'`);
				}
				const stateful = this;
				const handle = {
					destroy() {
						const observedState = observedStateMap.get(stateful);
						if (observedState) {
							observedState.subscription.unsubscribe();
							observedStateMap.delete(stateful);
						}
					}
				};
				const subscription = observable
					.observe(id)
					.subscribe(
						(state) => {
							setStatefulState(stateful, state);
						},
						(err) => {
							throw err;
						},
						() => {
							completeStatefulState(stateful);
						}
					);

				observedStateMap.set(stateful, { id, observable, subscription: <Subscription> subscription, handle });
				return handle;
			}
		},
		initialize(instance: StatefulMixin<Object> & Evented, options: StatefulOptions<Object>) {
			stateWeakMap.set(instance, Object.create(null));
			instance.own({
				destroy() {
					stateWeakMap.delete(instance);
				}
			});
			if (options) {
				const { id, stateFrom } = options;
				if (typeof id !== 'undefined' && stateFrom) {
					instance.own(instance.observeState(id, stateFrom));
				}
				else if (stateFrom) {
					throw new TypeError('When "stateFrom" option is supplied, factory also requires "id" option.');
				}
			}
		}
	});

export default createStateful;
