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
	},
	'advice': {
		'before advice': {
			'compose API': function () {
				class Foo {
					foo(a: string): string {
						return a;
					}
				}

				function advice(...args: any[]): any[] {
					args[0] = args[0] + 'bar';
					return args;
				}

				const FooBar = compose({
					foo: compose.before(Foo, 'foo', advice)
				});

				const foobar = new FooBar();
				const result = foobar.foo('foo');
				assert.strictEqual(result, 'foobar', '"result" shoud equal "foobar"');
			}
		},
		'after advice': {
			'compose API': function () {
				class Foo {
					foo(a: string): string {
						return 'foo';
					}
				}

				function advice(previousResult: string, ...args: any[]) {
					return previousResult + 'bar' + args[0];
				}

				const FooBar = compose({
					foo: compose.after(Foo, 'foo', advice)
				});

				const foobar = new FooBar();
				const result = foobar.foo('qat');
				assert.strictEqual(result, 'foobarqat', '"restult" should equal "foobarqat"');
			}
		},
		'around advice': {
			'compose API': function() {
				class Foo {
					foo(a: string): string {
						return a;
					}
				}

				function advice(origFn: (a: string) => string): (...args: any[]) => string {
					return function(...args: any[]): string {
						args[0] = args[0] + 'bar';
						return origFn.apply(this, args) + 'qat';
					};
				}

				const FooBar = compose({
					foo: compose.around(Foo, 'foo', advice)
				});

				const foobar = new FooBar();
				const result = foobar.foo('foo');
				assert.strictEqual(result, 'foobarqat', '"result" should equal "foobarqat"');
			}
		}
	}
});
