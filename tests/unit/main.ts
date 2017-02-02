import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import * as main from '../../src/main';

registerSuite({
	name: 'src/compose',
	'validate api'() {
		assert.isFunction(main.compose);
		assert.isFunction(main.isComposeFactory);
		assert.isFunction(main.compose({}).mixin(main.destroyableMixin));
		assert.isFunction(main.compose({}).mixin(main.eventedMixin));
		assert.isFunction(main.compose({}).mixin(main.statefulMixin));
	}
});
