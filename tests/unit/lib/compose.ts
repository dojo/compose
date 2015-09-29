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
	},
	from: {
		'compose API': function () {
			class Foo {
				bar: string;
				foo(): string {
					return this.bar;
				}
			}

			const FooBar = compose({
				bar: 'qat',
				foo: compose.from<typeof Foo.prototype.foo>(Foo, 'foo')
			});

			const foobar = new FooBar();
			foobar.bar = 'baz';
			assert.strictEqual(foobar.foo(), 'baz', 'Return from ".foo()" should equal "baz"');
		},
		'compose class API': function () {
			class Foo {
				bar: string;
				foo(): string {
					return this.bar;
				}
			}

			const FooBar = compose({
				bar: 'qat',
				foo: function (): string { return 'foo'; }
			}).from(Foo, 'foo');

			const foobar = new FooBar();
			assert.strictEqual(foobar.foo(), 'qat', 'Return from ".foo()" should equal "qat"');
		}
	}
});
