import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import * as lib from 'src/main';

registerSuite({
	name: 'src/compose',
	'validate api'() {
		assert.isFunction(lib.default);
		assert.isFunction(lib.default.after);
		assert.isFunction(lib.isComposeFactory);
	}
});
