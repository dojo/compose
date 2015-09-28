import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import compose from '../../../src/compose';

registerSuite({
	name: 'lib/compose',
	create: function () {
		const Foo = compose({ foo: 'bar' });
		const foo = new Foo();
		assert(foo);
		assert.strictEqual(foo.foo, 'bar', '"foo.foo" should equal "bar"');
		assert.strictEqual(foo.constructor, Foo, '"foo.constructor" should be "Foo"');
		assert.instanceOf(foo, Foo, '"foo" should be instance of "Foo"');
	}
});
