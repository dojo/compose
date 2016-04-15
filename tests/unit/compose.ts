import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import compose, { GenericClass, ComposeMixinDescriptor } from '../../src/compose';

let _hasStrictModeCache: boolean;

/**
 * Detects if the current runtime environment fully supports
 * strict mode (IE9 does not).
 */
function hasStrictMode(): boolean {
	if (_hasStrictModeCache !== undefined) {
		return _hasStrictModeCache;
	}
	try {
		const f = new Function(`return function f() {
			'use strict';
			var a = 021;
			var b = function (eval) {}
			var c = function (arguments) {}
			function d(foo, foo) {}
			function e(eval, arguments) {}
			function eval() {}
			function arguments() {}
			function interface(){}
			with (x) { }
			try { eval++; } catch (arguments) {}
			return { x: 1, y: 2, x: 1 }
		}`);
		f();
	}
	catch (err) {
		return _hasStrictModeCache = true;
	}
	return _hasStrictModeCache = false;
}

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

			const createFoo = compose(Foo);
			const foo = createFoo();
			foo.foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.instanceOf(foo, createFoo, 'foo is an instaceOf createFoo');
		},
		'prototype': function () {
			let counter = 0;

			const createFoo = compose({
				foo: function () {
					counter++;
				}
			});

			const foo = createFoo();
			foo.foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.instanceOf(foo, createFoo, 'foo is an instanceOf Foo');
		},

		'init function arguments'() {
			const proto = { foo: 'bar' };
			const opts = { bar: 3 };

			const createFoo = compose(proto, (instance, options) => {
				assert.deepEqual(instance, proto);
				assert.notStrictEqual(instance, proto);
				assert.isObject(options);
				assert.deepEqual(options, opts);
				instance.foo = 'baz';
			});

			const foo = createFoo(opts);
			assert.strictEqual(foo.foo, 'baz');
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

			const createFoo = compose(<GenericClass< { foo(): void; } >> <any> Foo);
			const foo = createFoo();
			foo.foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.instanceOf(foo, createFoo, 'foo is an instanceOf Foo');
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

			const createFoo = compose(Foo);
			const foo = createFoo();
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

			function initFoo(instance: Foo) {
				instance.foo();
			}

			const createFoo = compose(Foo, initFoo);

			createFoo();
			assert.strictEqual(counter, 1, 'the initialisation function fired');
		},
		'initialise function with prototype': function () {
			let counter = 0;

			function initFoo(instance: {foo: () => any, bar: string}) {
				instance.foo();
				instance.bar = 'foo';
			}

			const createFoo = compose({
				foo: function () {
					counter++;
				},
				bar: <string> undefined
			}, initFoo);

			const foo = createFoo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.strictEqual(foo.bar, 'foo', 'properly initialised property .bar');
		},
		'initialize with options object': function() {
			const createFoo = compose(
				{ foo: '' },
				function(instance: {foo: string}, options?: any) {
					instance.foo = options.foo;
				}
			);

			const foo = createFoo({ foo: 'bar' });

			assert.strictEqual(foo.foo, 'bar', 'properly initialized from options bag');
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

			function initFoo(instance: {foo: () => any, bar: string}, options?: any) {
				constructOptions = options;
				instance.foo();
				instance.bar = 'foo';
			}

			const createFoo = compose(<GenericClass< { foo(): void; bar: string; } >> <any> Foo, initFoo);
			const foo = createFoo({ bar: 'baz' });
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.strictEqual(foo.bar, 'foo', 'bar is initialised to foo');
			assert.instanceOf(foo, createFoo, 'foo is an instanceOf Foo');
		},
		'initialize function ordering'() {
			/* The goal here is two fold, mixed in init functions should be called
			 * first, in order for them to have the proper effect on the instance
			 * as well as duplicate functions should be eliminated (diamond problem)
			 */

			const callstack: string[] = [];

			const createFoo = compose({
				foo: 'bar'
			}, () => {
				callstack.push('foo');
			});

			const createFooBar = compose({
					bar: 1
				}, () => {
					callstack.push('foobar');
				})
				.mixin(createFoo);

			const createFooBaz = compose({
					baz: true
				}, () => {
					callstack.push('foobaz');
				})
				.mixin(createFoo);
			const createFooBarBazQat = compose({
					qat: /qat/
				}, () => {
					callstack.push('foobarbazqat');
				})
				.mixin( createFooBar )
				.mixin({
					mixin: createFooBaz,
					initialize: function(instance: { qat: RegExp; baz: boolean; foo: string; }) {
						callstack.push('foobazMixinInit');
					}
				});

			createFooBarBazQat();

			assert.deepEqual(callstack, [ 'foo', 'foobaz', 'foobazMixinInit', 'foobar', 'foobarbazqat' ],
				'Init functions should be called in proper order and duplicates eliminated');
		},
		'.create()': function () {
			let counter = 0;

			class Foo {
				foo() {
					counter++;
				}
			}

			const createFoo = compose.create(Foo);
			const foo = createFoo();
			foo.foo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.instanceOf(foo, createFoo, 'foo is an instaceOf createFoo');
		},
		'call with new': function () {
			const createFoo = compose({
				foo(): string {
					return 'bar';
				}
			});

			assert.throws(function () {
				const foo = new (<any> createFoo)();
				foo;
			}, SyntaxError, 'Factories cannot be called with "new"');
		},
		'immutability': function () {
			'use strict';

			if (typeof navigator !== 'undefined' && navigator.userAgent.match('Trident/5.0')) {
				this.skip('IE9 does not throw on frozen objects?!');
			}

			const createFoo = compose({
				foo(): string {
					return 'bar';
				}
			});

			assert.throws(function () {
				(<any> createFoo).bar = 'qat';
			}, TypeError);
		},

		'getters and setters': function() {
			const createFoo = compose({
				_foo: '',
				set foo(foo) {
					this._foo = foo;
				},
				get foo() {
					return this._foo;
				}
			});

			const foo = createFoo();
			foo.foo = 'bar';

			assert.strictEqual(foo._foo, 'bar', 'Should have used setter and set value');
			assert.strictEqual(foo.foo, 'bar', 'Should use getter and return set value');
		},

		'only getter': function() {
			const createFoo = compose({
				_foo: '',
				get foo() {
					return this._foo + 'bar';
				}
			});

			const foo = createFoo();

			assert.strictEqual(foo.foo, 'bar', 'Should have returned value from getter');
			foo._foo = 'foo';
			assert.strictEqual(foo.foo, 'foobar', 'Getter didn\'t get updated value');
		},

		'only setter': function() {
			const createFoo = compose({
				_foo: '',
				set foo(foo: string) {
					this._foo = foo;
				}
			});

			const foo = createFoo();
			foo.foo = 'bar';

			assert.strictEqual(foo._foo, 'bar', 'Setter should have set value');
			assert.notOk(foo.foo, 'No getter should be defined');
		},

		'non-configurable property': function() {
			'use strict';
			const composeObj = {};
			Object.defineProperty(composeObj, 'nonConfigurable', { configurable: false });
			Object.defineProperty(composeObj, 'configurable', { configurable: true });
			const createFoo = compose(composeObj);

			const foo = createFoo();

			Object.defineProperty(Object.getPrototypeOf(foo), 'configurable', { configurable: true });

			// Prototype has non configurable property
			assert.throws(function () {
				Object.defineProperty(Object.getPrototypeOf(foo), 'nonConfigurable', { configurable: true });
			}, TypeError);

			// But instance can still be configured
			Object.defineProperty(foo, 'nonConfigurable', { configurable: true });
		},

		'non-writable property': function() {
			const composeObj: { [ index: string ]: string } = {};
			Object.defineProperty(composeObj, 'nonWritable', { value: 'constant', writable: false });
			const createFoo = compose(composeObj);

			const foo = createFoo();

			assert.strictEqual(foo['nonWritable'], 'constant', 'Didn\'t copy property value');

			if (hasStrictMode()) {
				/* modules are now emitted in strict mode, which causes a throw
				* when trying to assign to a read-only property */
				assert.throws(() => {
					foo['nonWritable'] = 'variable';
				}, TypeError);
			}
			else {
				/* unless of course it is IE9 :-( */
				foo['nonWritable'] = 'variable';
				assert.strictEqual(foo['nonWritable'], 'constant');
			}
		},

		'non-enumerable property': function() {
			const composeObj: { [ index: string ]: string } = {};
			Object.defineProperty(composeObj, 'nonEnumerable', { value: 'value', enumerable: false });
			const createFoo = compose(composeObj);

			const foo = createFoo();
			const fooPrototype = Object.getPrototypeOf(foo);

			assert.strictEqual(foo['nonEnumerable'], 'value', 'Didn\'t copy non-enumerable property');
			assert.notInclude(Object.keys(fooPrototype), 'nonEnumerable', 'Keys included non-enumerable property');
			assert.include(Object.getOwnPropertyNames(fooPrototype), 'nonEnumerable',
				'Own property names did not include non-enumerable property');
		}
	},
	extend: {
		'.extend()': function () {
			const createFoo = compose.create({
				foo: 'foo'
			});

			const createFooBar = compose.extend(createFoo, {
				bar: 2
			});

			const foo = createFoo();
			const foobar = createFooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar, 2, 'instance contains bar');
			assert.strictEqual(foo.foo, 'foo', 'instance contains foo');
			assert.isUndefined((<any> foo).bar, 'instance does not contain bar');
		},
		'chaining': function () {
			const createFooBar = compose.create({
				foo: 'foo'
			}).extend({
				bar: 2
			});

			const foobar = createFooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar, 2, 'instance contains bar');
		},
		'extend with factory': function() {
			const createFoo = compose.create({
				foo: 'foo'
			}, instance => instance.foo = 'bar');
			const createBar = compose.create({
				bar: 'bar'
			}, instance => instance.bar = 'foo');
			const createFooBar = createFoo.extend(createBar);

			const fooBar = createFooBar();

			assert.strictEqual(fooBar.foo, 'bar', 'Should have run original init function');
			assert.strictEqual(fooBar.bar, 'bar', 'Should have included extension type and not init function');
		}
	},
	mixin: {
		'.mixin()': function () {
			const createFoo = compose.create({
				foo: 'foo'
			});

			const createBar = compose.create({
				bar: 2
			});

			const createFooBar = compose.mixin(createFoo, createBar);
			const foobar = createFooBar();
			const foo = createFoo();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar, 2, 'instance contains foo');
			assert.strictEqual(foo.foo, 'foo', 'instance contains foo');
			assert.isUndefined((<any> foo).bar, 'instance does not contain bar');
		},
		'chaining': function () {
			const createBar = compose.create({
				bar: 2
			});

			const createFooBar = compose({
				foo: 'foo'
			}).mixin(createBar);

			const foobar = createFooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar, 2, 'instance contains bar');
		},
		'concat init functions'() {
			const createBar = compose({
				bar: 2
			}, function(instance) {
				instance.bar = 3;
			});

			const createFooBar = compose({
				foo: 'foo'
			}, function(instance) {
				instance.foo = 'bar';
			}).mixin(createBar);

			const foobar = createFooBar();

			assert.strictEqual(foobar.foo, 'bar', 'instance contains foo');
			assert.strictEqual(foobar.bar, 3, 'instance containce bar');
		},
		'duplicate init functions'() {
			let called = 0;
			const createBar = compose({
				bar: 2
			}, function() {
				called++;
			});

			const createBarBaz = compose({
				baz: false
			}, function(instance) {
				instance.baz = true;
			}).mixin(createBar);

			const createBarQat = compose({
				qat: 'qat'
			}, function(instance) {
				instance.qat = 'foo';
			}).mixin(createBar);

			const createFooBarBazQat = compose({
				foo: 'foo'
			}, function(instance) {
				instance.foo = 'bar';
			})
				.mixin(createBarQat)
				.mixin(createBarBaz);

			createFooBarBazQat();
			assert.strictEqual(called, 1, 'Init function only called once');
		},
		'es6 class': function () {
			class Bar {
				bar(): number {
					return 2;
				}
			}

			const createFoo = compose({
				foo: 'foo'
			});

			const createFooBar = compose.mixin(createFoo, { mixin: Bar });

			const foobar = createFooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar(), 2, 'instance contains bar');
		},

		'es6 class and initialize': function() {
			class Bar {
				bar(): number {
					return 2;
				};
				baz: string;
			}

			function initBar(instance: Bar) {
				instance.baz = 'boo';
			}

			const createFoo = compose({
				foo: 'foo'
			});

			const createFooBar = compose.mixin(createFoo, { mixin: Bar, initialize: initBar });

			const foobar = createFooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar(), 2, 'instance contains bar');
			assert.strictEqual(foobar.baz, 'boo', 'instance contains boo');
		},

		'compose factory and initialize': function() {
			const createBar = compose({
				bar: 2
			}, function(instance: any) {
				// This runs first, as it's the existing initialize on the base of the mixin
				instance.foo = 'bar';
			});

			const createFooBar = compose({
				foo: 'foo',
				baz: ''
			}, function(instance: any) {
				// This runs last, as it's the initialize on the base class
				instance.bar = 3;
				assert.strictEqual(instance.baz, 'baz', 'instance contains baz');
			}).mixin({
				mixin: createBar,
				initialize: function(instance: any) {
					// This runs second, as it's the new, optional initialize provided with the mixin
					assert.strictEqual(instance.foo, 'bar', 'instance contains foo');
					instance.baz = 'baz';
				}
			});

			const foobar = createFooBar();
			assert.strictEqual(foobar.bar, 3, 'instance contains bar');

		},

		'only initialize': function() {
			const createFoo = compose({
				foo: 'foo'
			}).mixin({
				initialize: function(instance: any) {
					instance.foo = 'bar';
				}
			});

			const foo = createFoo();
			assert.strictEqual(foo.foo, 'bar', 'initialize was called');
		},

		'only aspect': function() {
			const createFoo = compose({
				foo: function() {
					this.baz = 'bar';
				},
				bar: '',
				baz: ''
			}).mixin({
				aspectAdvice: {
					after: {
						foo: function() {
							this.bar = 'baz';
						}
					}
				}
			});

			const foo = createFoo();
			foo.foo();
			assert.strictEqual(foo.baz, 'bar', 'function ran');
			assert.strictEqual(foo.bar, 'baz', 'aspect ran');
		},

		'base, initialize, and aspect': function() {
			const createFoo = compose({}).mixin({
				mixin: compose({
					foo: 'foo',
					bar: '',
					doneFoo: false,
					doFoo: function() {
						this.foo = 'bar';
					}
				}),
				initialize: function(instance: any) {
					instance.bar = 'bar';
				},
				aspectAdvice: {
					after: {
						doFoo: function() {
							this.doneFoo = true;
						}
					}
				}
			});

			const foo = createFoo();
			assert.strictEqual(foo.foo, 'foo', 'contains foo property');
			assert.strictEqual(foo.bar, 'bar', 'initialize ran');

			foo.doFoo();
			assert.strictEqual(foo.foo, 'bar', 'ran function');
			assert.isTrue(foo.doneFoo, 'ran aspect');
		},

		'mixin with plain object': function() {
			const createFoo = compose({
				baz: 'baz'
			}).mixin({
				mixin: {
					foo: 'foo',
					bar: 3
				}
			});

			const foo = createFoo();
			assert.strictEqual(foo.baz, 'baz', 'contains baz property');
			assert.strictEqual(foo.foo, 'foo', 'contains foo property');
			assert.strictEqual(foo.bar, 3, 'contains bar property');
		},

		'Shouldn\'t duplicate init functions passed directly to mixin': function() {
			const init = function(instance: { count: number; baz: string}) {
				instance.count = instance.count + 1;
			};
			const otherInitializer = function(instance: any) {
				instance.foo = 'bar';
			};
			const createFoo = compose({
				count: 0
			}, function(instance: { count: number }) {
				instance.count = instance.count + 1;
			})
				.mixin({ initialize: init })
				.mixin({ initialize: init })
				.mixin({ mixin: { baz: 'baz' }, initialize: init })
				.mixin({ initialize: otherInitializer });

			const foo = createFoo();
			assert.strictEqual((<any> foo).foo, 'bar', 'Should have called other initialize as well');
			assert.strictEqual(foo.count, 2, 'Should have called base initialize and passed in initialize once each');
		},

		'Init function with combined types': function() {
			interface Bar {
				bar: string;
			}
			interface Baz {
				baz: number;
			}
			const createBar = compose<Bar, Bar>({
				bar: ''
			}, function(instance: Bar, options: Bar) {
				if (options.bar) {
					instance.bar = options.bar;
				}
			});
			const createBaz = compose<Baz, Baz>({
				baz: 1
			}, function(instance: Baz, options: Baz) {
				if (options.baz) {
					instance.baz = options.baz;
				}
			});
			createBar.mixin({
				initialize: function(instance: { bar: string; baz: number }, options: { bar: string; baz: number }) {

				},
				mixin: createBaz
			});
			createBar.mixin({
				initialize: function(instance: { baz: number }, options: { baz: number }) {

				},
				mixin: createBaz
			});
			createBar.mixin({
				initialize: function(instance: { bar: string }, options: { bar: string }) {

				},
				mixin: createBaz
			});
			// Shouldn\'t compile
			// const createBarBazIllegalInstanceType = createBar.mixin({
			// initialize: function(instance: { baz: number; foo: number }) {
            //
			// },
			// mixin: createBaz
			// });
			// const createBarBazIllegalOptionsType = createBar.mixin({
			// initialize: function(instance: { baz: number; }, options: { baz: number; foo: string; }) {
            //
			// },
			// mixin: createBaz
			// });
		},

		'Object with factoryDescriptor function': function() {
			const createFooBar = compose({
				foo: ''
			}, function(foo: { foo: string }) {
				foo.foo = 'foo';
			}).mixin({
				factoryDescriptor: function() {
					return {
						mixin: {
							bar: 1
						},
						initialize: function(fooBar: { bar: number; foo: string; }) {
							fooBar.bar = 3;
							fooBar.foo = 'bar';
						}
					};
				}
			});

			const fooBar = createFooBar();
			assert.strictEqual(fooBar.foo, 'foo', 'Foo property not present');
			assert.strictEqual(fooBar.bar, 3, 'Bar property not present');
		}
	},
	overlay: {
		'.overlay()': function () {
			let count: number = 0;

			const createFoo = compose.create({
				foo: 'foo'
			});

			const createFooOverlayed = compose.overlay(createFoo, function (proto) {
				proto.foo = 'bar';
				count++;
			});

			const fooOverlayed = createFooOverlayed();
			createFooOverlayed();

			assert.strictEqual(fooOverlayed.foo, 'bar', 'the overlayed function was called');
			assert.strictEqual(count, 1, 'call count of 1');
		},
		'chaining': function () {
			const createFoo = compose.create({
				foo: 'foo'
			}).overlay(function (proto) {
				proto.foo = 'bar';
			});

			const foo = createFoo();

			assert.strictEqual(foo.foo, 'bar', 'the overlayed function was called');
		}
	},
	from: {
		'compose API': function () {
			class Foo {
				bar: string;
				foo(): string {
					return this.bar;
				}
			}

			const createFooBar = compose({
				bar: 'qat',
				foo: compose.from<typeof Foo.prototype.foo>(Foo, 'foo')
			});

			const foobar = createFooBar();
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

			const createFooBar = compose({
				bar: 'qat',
				foo: function (): string { return 'foo'; }
			}).from(Foo, 'foo');

			const foobar = createFooBar();
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

				const createFooBar = compose({
					foo: compose.before(Foo, 'foo', advice)
				});

				const foobar = createFooBar();
				const result = foobar.foo('foo');
				assert.strictEqual(result, 'foobar', '"result" should equal "foobar"');
			},
			'generic function': function () {
				function foo(a: string): string {
					return a;
				}

				function advice(...args: any[]): any[] {
					args[0] = args[0] + 'bar';
					return args;
				}

				const createFoo = compose({
					foo: compose.before(foo, advice)
				});

				const instance = createFoo();
				const result = instance.foo('foo');
				assert.strictEqual(result, 'foobar', '"result" should equal "foobar"');
			},
			'transfer generic type': function() {
				class Foo<T> {
					foo: T;
				}

				class Bar<T> {
					bar(opt: T): void {
						console.log(opt);
					}
				}

				interface FooBarClass {
					<T, U>(): Foo<T>&Bar<U>;
				}

				let fooBarFactory: FooBarClass = compose(Foo).mixin({ mixin: <any>  Bar });

				fooBarFactory<number, any>();
			},
			'chaining': function () {
				class Foo {
					foo(a: string): string {
						return a;
					}
				}

				function advice(...args: any[]): any[] {
					args[0] = args[0] + 'bar';
					return args;
				}

				const createFooBar = compose(Foo)
					.before('foo', advice);

				const foobar = createFooBar();
				const result = foobar.foo('foo');
				assert.strictEqual(result, 'foobar', '"result" should equal "foobar"');
			}
		},
		'after advice': {
			'compose API': function () {
				class Foo {
					foo(a: string): string {
						return 'foo';
					}
				}

				function advice(previousResult: string, ...args: any[]): string {
					return previousResult + 'bar' + args[0];
				}

				const createFooBar = compose({
					foo: compose.after(Foo, 'foo', advice)
				});

				const foobar = createFooBar();
				const result = foobar.foo('qat');
				assert.strictEqual(result, 'foobarqat', '"result" should equal "foobarqat"');
			},
			'generic function': function () {
				function foo(a: string): string {
					return 'foo';
				}

				function advice(previousResult: string, ...args: any[]): string {
					return previousResult + 'bar' + args[0];
				}

				const createFoo = compose({
					foo: compose.after(foo, advice)
				});

				const instance = createFoo();
				const result = instance.foo('qat');
				assert.strictEqual(result, 'foobarqat', '"result" should equal "foobarqat"');
			},
			'chaining': function () {
				class Foo {
					foo(a: string): string {
						return 'foo';
					}
				}

				function advice(previousResult: string, ...args: any[]): string {
					return previousResult + 'bar' + args[0];
				}

				const createFooBar = compose(Foo)
					.after('foo', advice);

				const foobar = createFooBar();
				const result = foobar.foo('qat');
				assert.strictEqual(result, 'foobarqat', '"result" should equal "foobarqat"');
			}
		},
		'around advice': {
			'compose API': function () {
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

				const createFooBar = compose({
					foo: compose.around(Foo, 'foo', advice)
				});

				const foobar = createFooBar();
				const result = foobar.foo('foo');
				assert.strictEqual(result, 'foobarqat', '"result" should equal "foobarqat"');
			},
			'generic function': function () {
				function foo(a: string): string {
					return a;
				}

				function advice(origFn: (a: string) => string): (...args: any[]) => string {
					return function(...args: any[]): string {
						args[0] = args[0] + 'bar';
						return origFn.apply(this, args) + 'qat';
					};
				}

				const createFoo = compose({
					foo: compose.around(foo, advice)
				});

				const instance = createFoo();
				const result = instance.foo('foo');
				assert.strictEqual(result, 'foobarqat', '"result" should equal "foobarqat"');
			},
			'chaining': function () {
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

				const createFooBar = compose(Foo)
					.around('foo', advice);

				const foobar = createFooBar();
				const result = foobar.foo('foo');
				assert.strictEqual(result, 'foobarqat', '"result" should qual "foobarqat"');
			}
		},
		'aspect': {
			'compose API': {
				'before advice': function () {
					const createFoo = compose({
						foo: function (a: string): string {
							return a;
						}
					});

					const createBeforeFoo = compose.aspect(createFoo, {
						before: {
							foo: function(...args: any[]): any[] {
								args[0] = args[0] + 'bar';
								return args;
							}
						}
					});

					const foo = createBeforeFoo();
					const result = foo.foo('foo');
					assert.strictEqual(result, 'foobar', '"result" should equal "foobar"');
				},
				'after advice': function () {
					const createFoo = compose({
						foo: function (a: string): string {
							return 'foo';
						}
					});

					const createAfterFoo = compose.aspect(createFoo, {
						after: {
							foo: function (previousResult: string, ...args: any[]): string {
								return previousResult + 'bar' + args[0];
							}
						}
					});

					const foo = createAfterFoo();
					const result = foo.foo('qat');
					assert.strictEqual(result, 'foobarqat', '"result" should equal "foobarqat"');
				},
				'around advice': function () {
					const createFoo = compose({
						foo: function (a: string): string {
							return a;
						}
					});

					const createAroundFoo = compose.aspect(createFoo, {
						around: {
							foo: function (origFn: (a: string) => string): (...args: any[]) => string {
								return function(...args: any[]): string {
									args[0] = args[0] + 'bar';
									return origFn.apply(this, args) + 'qat';
								};
							}
						}
					});

					const foo = createAroundFoo();
					const result = foo.foo('foo');
					assert.strictEqual(result, 'foobarqat', '"result" should qual "foobarqat"');
				},
				'mixed': function () {
					const createFoo = compose({
						foo: function (a: string): string {
							return a;
						},
						bar: function (a: string): string {
							return a;
						}
					});

					const createAspectFoo = compose.aspect(createFoo, {
						before: {
							foo: function(...args: any[]): any[] {
								args[0] = args[0] + 'bar';
								return args;
							}
						},
						after: {
							foo: function (previousResult: string, ...args: any[]): string {
								return previousResult + 'bar' + args[0];
							}
						},
						around: {
							bar: function (origFn: (a: string) => string): (...args: any[]) => string {
								return function(...args: any[]): string {
									args[0] = args[0] + 'bar';
									return origFn.apply(this, args) + 'qat';
								};
							}
						}
					});

					const foo = createAspectFoo();
					const resultFoo = foo.foo('foo');
					const resultBar = foo.bar('foo');
					assert.strictEqual(resultFoo, 'foobarbarfoobar', '"resultFoo" should equal "foobarbarfoobar"');
					assert.strictEqual(resultBar, 'foobarqat', '"resultBar" should equal "foobarqat"');
				},
				'empty': function () {
					const createFoo = compose({
						foo: function (a: string): string {
							return a;
						},
						bar: function (a: string): string {
							return a;
						}
					});

					const createAspectFoo = compose.aspect(createFoo, {});
					const foo = createAspectFoo();

					const resultFoo = foo.foo('foo');
					const resultBar = foo.bar('foo');
					assert.strictEqual(resultFoo, 'foo', '"resultFoo" should equal "foo"');
					assert.strictEqual(resultBar, 'foo', '"resultBar" should equal "foo"');
				}
			},
			'chaining': function () {
				const createFoo = compose({
					foo: function (a: string): string {
						return a;
					},
					bar: function (a: string): string {
						return a;
					}
				}).aspect({
					before: {
						foo: function(...args: any[]): any[] {
							args[0] = args[0] + 'bar';
							return args;
						}
					},
					after: {
						foo: function (previousResult: string, ...args: any[]): string {
							return previousResult + 'bar' + args[0];
						}
					},
					around: {
						bar: function (origFn: (a: string) => string): (...args: any[]) => string {
							return function(...args: any[]): string {
								args[0] = args[0] + 'bar';
								return origFn.apply(this, args) + 'qat';
							};
						}
					}
				});

				const foo = createFoo();
				const resultFoo = foo.foo('foo');
				const resultBar = foo.bar('foo');
				assert.strictEqual(resultFoo, 'foobarbarfoobar', '"resultFoo" should equal "foobarbarfoobar"');
				assert.strictEqual(resultBar, 'foobarqat', '"resultBar" should equal "foobarqat"');
			},
			'missing method': function () {
				const createFoo = compose({
					foo: function (a: string): string {
						return a;
					}
				});

				assert.throws(function () {
					const BeforeFoo = compose.aspect(createFoo, {
						before: {
							bar: function(...args: any[]): any[] {
								args[0] = args[0] + 'bar';
								return args;
							}
						}
					});
					BeforeFoo;
				}, Error, 'Trying to advise non-existing method: "bar"');
			}
		},
		'static': {
			'create factory with static method': function() {
				const createFoo = compose({
					foo: 1
				}).static({
					doFoo(): string {
						return 'foo';
					}
				});

				assert.strictEqual(createFoo.doFoo(), 'foo', 'Should have done foo');
				assert.strictEqual(createFoo().foo, 1, 'Should still have foo property on instance');
				// Shouldn't compile
				// assert.strictEqual(createFoo().doFoo(), 'Should not have do foo function on instance');
			},

			'extend existing factory with static method': function() {
				const createFoo = compose({
					foo: 1
				});

				const createAndDoFoo = compose.static(createFoo, {
					doFoo(): string {
						return 'foo';
					}
				});

				assert.strictEqual(createAndDoFoo.doFoo(), 'foo', 'Should have done foo');
				assert.strictEqual(createAndDoFoo().foo, 1, 'Should still have foo property on instance');
				// Shouldn't compile
				// assert.strictEqual(createAndDoFoo().doFoo(), 'Should not have do foo function on instance');
			},

			'override factory descriptor function with static method': function() {
				const createFoo = compose({
					foo: 1
				}).static({
					factoryDescriptor(): ComposeMixinDescriptor<any, any, { foo: number }, any> {
						return {
							mixin: this,
							initialize: function(instance: { foo: number }) {
								instance.foo = 3;
							}
						};
					}
				});

				const createFooBar = compose({
					bar: 1
				}).mixin(createFoo);

				const fooBar = createFooBar();

				assert.strictEqual(fooBar.bar, 1, 'Should have bar property');
				assert.strictEqual(fooBar.foo, 3, 'Should have foo property');
			},

			'Passing a factory to static': function() {
				const createFoo = compose({}).static({
					doFoo: (): string => 'foo'
				});

				const createBar = compose({}).static(createFoo);

				assert.strictEqual(createBar.doFoo(), 'foo', 'Should have transferred static property');
			},

			'Passing a factory with no static methods to static': function() {
				assert.doesNotThrow(function() {
					compose({}).static(compose({}));
				}, 'Should have handled factory with no static methods without throwing');
			}
		}
	}
});
