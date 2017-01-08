import { deepAssign } from 'dojo-core/lang';
import {
	State,
	Stateful,
	StatefulMixin,
	StatefulOptions
} from 'dojo-interfaces/bases';
import WeakMap from 'dojo-shim/WeakMap';
import createEvented from './createEvented';
import { ComposeFactory } from '../compose';

/**
 * Stateful Factory
 */
export interface StatefulFactory extends ComposeFactory<StatefulMixin<State>, StatefulOptions<State>> {}

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
const createStateful: StatefulFactory = createEvented
	.mixin({
		className: 'Stateful',
		mixin: {
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
		},
		initialize(instance: Stateful<State>) {
			instanceStateMap.set(instance, Object.create(null));
		}
	});

export default createStateful;
