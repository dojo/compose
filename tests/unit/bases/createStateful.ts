import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import createStateful from '../../../src/bases/createStateful';

registerSuite({
	name: 'mixins/createStateful',
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
	}
});
