import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import statefulMixin from '../../../src/bases/statefulMixin';
import { Stateful, State } from '@dojo/interfaces/bases';
import compose from '../../../src/compose';

const createStateful = compose({}).mixin(statefulMixin);
registerSuite({
	name: 'mixins/statefulMixin',
	creation() {
		const stateful = createStateful();
		assert.deepEqual(stateful.state, {}, 'stateful should have empty state');
	},
	'get and set state'() {
		const stateful = createStateful();
		const state = {
			foo: 'bar'
		};
		stateful.setState(state);

		assert.deepEqual(stateful.state, state);
	},
	'partially update state'() {
		const stateful = createStateful();
		const state = {
			foo: 'bar'
		};
		const updatedState = {
			baz: 'qux'
		};

		stateful.setState(state);
		assert.deepEqual(stateful.state, state);
		stateful.setState(updatedState);
		assert.deepEqual(stateful.state, { foo: 'bar', baz: 'qux' });
	},
	'emits `state:changed` event on state update'() {
		const stateful: Stateful<State> = createStateful();
		const state = {
			foo: 'bar'
		};
		let called = false;

		stateful.on('state:changed', (event) => {
			called = true;
			assert.equal(event.target, stateful);
			assert.equal(event.type, 'state:changed');
			assert.deepEqual(event.state, state);
		});
		stateful.setState(state);
		assert.isTrue(called);
	}
});
