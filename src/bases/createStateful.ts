import { deepAssign } from 'dojo-core/lang';
import { Handle } from 'dojo-interfaces/core';
import {
	Evented,
	Stateful,
	State,
	StatefulOptions,
	StatefulMixin
} from 'dojo-interfaces/bases';
import { Observable, Subscription } from 'dojo-interfaces/observables';
import Promise from 'dojo-shim/Promise';
import WeakMap from 'dojo-shim/WeakMap';
import createEvented from './createEvented';
import { ComposeFactory } from '../compose';
import createCancelableEvent from './createCancelableEvent';

export interface ObservableState<S extends State> {
	/**
	 * A method that allows the return of an `Observable` interface for a particular `id`
	 * @param id The ID to observe
	 */
	observe(id: string): Observable<S>;

	/**
	 * A method that allows the `Stateful` to provide a change to its state, instead of
	 * changing its state directly.
	 * @param partial The partial state to be *patched*
	 * @param options A map of options, which includes the `id` being observed
	 */
	patch(partial: any, options?: { id?: string }): Promise<S>;
}

export interface StatefulFactory extends ComposeFactory<Stateful<State>, StatefulOptions<State>> {
	<S extends State>(options?: StatefulOptions<S>): Stateful<S>;
}

/**
 * Internal interface which contains references to an observed state
 */
interface ObservedState {
	id: string;
	observable: ObservableState<State>;
	subscription: Subscription;
	handle: Handle;
}

/**
 * A weak map of stateful instances to their obseved state references
 */
const observedStateMap = new WeakMap<Stateful<State>, ObservedState>();

/**
 * Internal function to unobserve the state of a `Stateful`.  It emits a `statecomplete` event which can be
 * cancelled.
 *
 * @param stateful The `Stateful` object to unobserve
 */
function completeStatefulState(stateful: Stateful<State>): void {
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
function setStatefulState(target: Stateful<State>, state: State): void {
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
const stateWeakMap = new WeakMap<Stateful<State>, State>();

/**
 * Create an instance of a stateful object
 */
const createStateful: StatefulFactory = createEvented
	.mixin({
		className: 'Stateful',
		mixin: {
			get stateFrom(this: Stateful<State>): ObservableState<State> | undefined {
				const observedState = observedStateMap.get(this);
				if (observedState) {
					return observedState.observable;
				}
			},

			get state(this: Stateful<State>): State {
				return stateWeakMap.get(this);
			},

			setState(this: Stateful<State>, value: State): void {
				const observedState = observedStateMap.get(this);
				if (observedState) {
					observedState.observable.patch(value, { id: observedState.id });
				}
				else {
					setStatefulState(this, value);
				}
			},

			observeState(this: Stateful<State>, id: string, observable: ObservableState<State>): Handle {
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

				observedStateMap.set(stateful, { id, observable, subscription, handle });
				return handle;
			}
		},
		initialize(instance: StatefulMixin<State> & Evented, options: StatefulOptions<State>) {
			stateWeakMap.set(instance, Object.create(null));
			instance.own({
				destroy() {
					stateWeakMap.delete(instance);
				}
			});
			if (options) {
				const { id, stateFrom, state } = options;
				if (typeof id !== 'undefined' && stateFrom) {
					instance.own(instance.observeState(id, stateFrom));
				}
				else if (stateFrom) {
					throw new TypeError('When "stateFrom" option is supplied, factory also requires "id" option.');
				}
				if (state) {
					instance.setState(state);
				}
			}
		}
	});

export default createStateful;
