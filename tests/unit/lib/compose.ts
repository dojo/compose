import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import compose, { GenericClass } from '../../../src/compose';

registerSuite({
	name: 'lib/compose',
	create: {
		'es6 base class': function () {
			let counter = 0;

			class Foo {
				foo() {
					counter++;
				}
			}

			const ComposeFoo = compose(Foo);
			const foo = new ComposeFoo();
			foo.foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.instanceOf(foo, ComposeFoo, 'foo is an instaceOf ComposeFoo');
		},
		'prototype': function () {
			let counter = 0;

			const Foo = compose({
				foo: function () {
					counter++;
				}
			});

			const foo = new Foo();
			foo.foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.instanceOf(foo, Foo, 'foo is an instanceOf Foo');
		},
		'constructor function': function () {
			let counter = 0;

			function Foo() {
				counter++;
			}

			Foo.prototype = {
				foo: function () {
					counter++;
				}
			};

			const ComposeFoo = compose(<GenericClass< { foo(): void; } >> <any> Foo);
			const foo = new ComposeFoo();
			foo.foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.instanceOf(foo, ComposeFoo, 'foo is an instanceOf Foo');
		},
		'typescript class': function () {
			this.skip('initialised own values from classes not supported');
			let result = 0;

			class Foo {
				foo(a: number) {
					result = a;
				}
				bar: number = 1;
			}

			const ComposeFoo = compose(Foo);
			const foo = new ComposeFoo();
			foo.foo(5);
			assert.strictEqual(result, 5, 'result equals value set');
			assert.strictEqual(foo.bar, 1, 'foo.bar should equal 1');
		},
		'initialise function with ES6 class': function () {
			let counter = 0;

			class Foo {
				foo() {
					counter++;
				}
			}

			function initFoo() {
				this.foo();
			}

			const ComposeFoo = compose(Foo, initFoo);

			const foo = new ComposeFoo();
			assert.strictEqual(counter, 1, 'the initialisation function fired');
		},
		'initialise function with prototype': function () {
			let counter = 0;

			function initFoo() {
				this.foo();
				this.bar = 'foo';
			}

			const Foo = compose({
				foo: function () {
					counter++;
				},
				bar: <string> undefined
			}, initFoo);

			const foo = new Foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.strictEqual(foo.bar, 'foo', 'properly initialised property .bar');
		},
		'initialise with constructor function': function () {
			let counter = 0;
			let constructOptions: any;

			function Foo() {
				counter++;
			}

			Foo.prototype = {
				foo: function () {
					counter++;
				},
				bar: <string> undefined
			};

			function initFoo(options?: any) {
				constructOptions = options;
				this.foo();
				this.bar = 'foo';
			}

			const ComposeFoo = compose(<GenericClass< { foo(): void; bar: string; } >> <any> Foo, initFoo);
			const foo = new ComposeFoo({ bar: 'baz' });
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.strictEqual(foo.bar, 'foo', 'bar is initialised to foo');
			assert.instanceOf(foo, ComposeFoo, 'foo is an instanceOf Foo');
		},
		'.create()': function () {
			let counter = 0;

			class Foo {
				foo() {
					counter++;
				}
			}

			const ComposeFoo = compose.create(Foo);
			const foo = new ComposeFoo();
			foo.foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.instanceOf(foo, ComposeFoo, 'foo is an instaceOf ComposeFoo');
		}
	},
	extend: {
		'.extend()': function () {
			const Foo = compose.create({
				foo: 'foo'
			});

			const FooBar = compose.extend(Foo, {
				bar: 2
			});

			const foo = new Foo();
			const foobar = new FooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar, 2, 'instance contains bar');
			assert.strictEqual(foo.foo, 'foo', 'instance contains foo');
			assert.isUndefined((<any> foo).bar, 'instance does not contain bar');
		},
		'chaining': function () {
			const FooBar = compose.create({
				foo: 'foo'
			}).extend({
				bar: 2
			});

			const foobar = new FooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar, 2, 'instance contains bar');
		}
	},
	mixin: {
		'.mixin()': function () {
			const Foo = compose.create({
				foo: 'foo'
			});

			const Bar = compose.create({
				bar: 2
			});

			const FooBar = compose.mixin(Foo, Bar);
			const foobar = new FooBar();
			const foo = new Foo();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar, 2, 'instance contains foo');
			assert.strictEqual(foo.foo, 'foo', 'instance contains foo');
			assert.isUndefined((<any> foo).bar, 'instance does not contain bar');
		},
		'chaining': function () {
			const Bar = compose.create({
				bar: 2
			});

			const FooBar = compose({
				foo: 'foo'
			}).mixin(Bar);

			const foobar = new FooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar, 2, 'instance contains foo');
		}
	},
	overlay: {
		'.overlay()': function () {
			let count: number = 0;

			const Foo = compose.create({
				foo: 'foo'
			});

			const FooOverlayed = compose.overlay(Foo, function (proto) {
				proto.foo = 'bar';
				count++;
			});

			const fooOverlayed = new FooOverlayed();
			const fooOverlayed2 = new FooOverlayed();

			assert.strictEqual(fooOverlayed.foo, 'bar', 'the overlayed function was called');
			assert.strictEqual(count, 1, 'call count of 1');
		},
		'chaining': function () {
			const Foo = compose.create({
				foo: 'foo'
			}).overlay(function (proto) {
				proto.foo = 'bar';
			});

			const foo = new Foo();

			assert.strictEqual(foo.foo, 'bar', 'the overlayed function was called');
		}
	}
});
