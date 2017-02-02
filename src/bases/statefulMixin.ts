import { deepAssign } from '@dojo/core/lang';
import {
	State,
	Stateful
} from '@dojo/interfaces/bases';
import WeakMap from '@dojo/shim/WeakMap';
import eventedMixin from './eventedMixin';

/**
 * Private map of internal instance state.
 */
const instanceStateMap = new WeakMap<Stateful<State>, State>();

/**
 * State change event type
 */
const stateChangedEventType = 'state:changed';

/**
 * Create an instance of a stateful object
 */
export default eventedMixin
	.extend('Stateful', {
		get state(this: Stateful<State>) {
			return instanceStateMap.get(this);
		},
		setState<S extends State>(this: Stateful<S>, value: Partial<S>) {
			const oldState = instanceStateMap.get(this);
			const state = deepAssign({}, oldState, value);
			const eventObject = {
				type: stateChangedEventType,
				state,
				target: this
			};
			instanceStateMap.set(this, state);
			this.emit(eventObject);
		}
	})
	.init((instance: Stateful<State>) => {
		instanceStateMap.set(instance, Object.create(null));
	});
