import { Handle } from 'dojo-core/interfaces';
import { deepAssign } from 'dojo-core/lang';
import Promise from 'dojo-shim/Promise';
import WeakMap from 'dojo-shim/WeakMap';
import { Observable, Subscription } from './interfaces';
import createEvented, { Evented, EventedOptions, EventedListener, TargettedEventObject } from './createEvented';
import { ComposeFactory } from '../compose';
import createCancelableEvent, { CancelableEvent } from './../util/createCancelableEvent';

/**
 * Base State interface
 */
export interface State {
	[prop: string]: any;
}

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

export interface StatefulOptions<S extends State> extends EventedOptions {
	/**
	 * State that should be set during creation
	 */
	state?: S;

	/**
	 * An ID to be used in conjunction with the `stateFrom` option to observe the state
	 */
	id?: string;

	/**
	 * An object that the Stateful should observe its state from, which supplies an `observe` and
	 * `patch` methods to be able to manage its state
	 */
	stateFrom?: ObservableState<S>;
}

export interface StateChangeEvent<S extends State> extends TargettedEventObject {
	/**
	 * The event type
	 */
	type: string;

	/**
	 * The state of the target
	 */
	state: S;

	/**
	 * A Stateful instance
	 */
	target: Stateful<S>;
}

export interface StatefulMixin<S extends State>{
	/**
	 * A read only view of the state
	 */
	readonly state: S;

	/**
	 * Set the state on the instance.
	 *
	 * Set state can take a partial value, therefore if a key is ommitted from the value, it will not be changed.
	 * To *clear* a value, set a key to `undefined`
	 *
	 * @param value The state (potentially partial) to be set
	 */
	setState(value: S): void;

	/**
	 * Observe (and update) the state from an Observable
	 * @param id The ID to be observed on the Observable
	 * @param observable An object which provides a `observe` and `patch` methods which allow `Stateful` to be able to
	 *                   manage its state.
	 */
	observeState(id: string, observable: ObservableState<S>): Handle;
}

export type Stateful<S extends State> = StatefulMixin<S> & Evented & {
	/**
	 * Add a listener for a `statecomplete` event, which occures when state is observed
	 * and is completed.  If the event is not cancelled, the instance will continue and
	 * call `target.destroy()`.
	 *
	 * @param type The event type to listen for
	 * @param listener The listener that will be called when the event occurs
	 */
	on(type: 'statecomplete', listener: EventedListener<CancelableEvent<'statecomplete', Stateful<S>>>): Handle;

	/**
	 * Add a listener for a `statechange` event, which occures whenever the state changes on the instance.
	 *
	 * @param type The event type to listen for
	 * @param listener The listener that will be called when the event occurs
	 */
	on(type: 'statechange', listener: EventedListener<StateChangeEvent<S>>): Handle;
	on(type: string, listener: EventedListener<TargettedEventObject>): Handle;
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
function unobserve(stateful: Stateful<State>): void {
	const observedState = observedStateMap.get(stateful);
	if (observedState) {
		observedState.handle.destroy();
		const statecomplete = createCancelableEvent({
			type: 'statecomplete',
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
function setStatefulState(stateful: Stateful<State>, state: State): void {
	state = deepAssign(stateWeakMap.get(stateful), state);
	stateful.emit({
		type: 'statechange',
		state,
		target: stateful
	});
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
				observedState = {
					id,
					observable,
					subscription: observable
						.observe(id)
						.subscribe(
							(item) => setStatefulState(stateful, item), /* next handler */
							(err) => {
								/* TODO: Should we emit an error, instead of throwing? */
								throw err;
							}, /* error handler */
							() => unobserve(stateful)), /* completed handler */
					handle: {
						destroy() {
							const observedState = observedStateMap.get(stateful);
							if (observedState) {
								observedState.subscription.unsubscribe();
								observedStateMap.delete(stateful);
							}
						}
					}
				};
				observedStateMap.set(stateful, observedState);
				return observedState.handle;
			}
		},
		initialize(instance: StatefulMixin<State> & Evented, options: StatefulOptions<State>) {
			/* Using Object.create(null) will improve performance when looking up properties in state */
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
