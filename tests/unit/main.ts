import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import * as main from '../../src/main';

registerSuite({
	name: 'src/compose',
	'validate api'() {
		assert.isFunction(main.compose);
		assert.isFunction(main.isComposeFactory);
		assert.isFunction(main.createDestroyable);
		assert.isFunction(main.createEvented);
		assert.isFunction(main.createStateful);
	}
});
