import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { setWarn } from '@dojo/core/instrument';
import { hasToStringTag, hasConfigurableName } from '../support/util';
import compose, { GenericClass, ComposeMixinDescriptor, getInitFunctionNames, ComposeCreatedMixin } from '../../src/compose';

let warnStack: any[][] = [];

registerSuite({
	name: 'lib/compose',

	setup() {
		/* change the global warning function so we don't end up with a console full of garbage */
		setWarn(function(...args: any[]) {
			warnStack.push(args);
		});
	},

	teardown() {
		/* put it back the way it was */
		setWarn();
	},

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
		'typescript class': function (this: any) {
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
		'other compose class'() {
			let result = 0;
			const createFoo = compose({
				foo(a: number) {
					result = a;
				}
			});

			const createFooInit = compose(createFoo, (instance) => {
				instance.foo(12);
			});

			createFooInit();
			assert.strictEqual(result, 12);
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
				bar: ''
			}, initFoo);

			const foo = createFoo();
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.strictEqual(foo.bar, 'foo', 'properly initialised property .bar');
		},
		'initialize with options object'() {
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
				bar: ''
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
				.mixin( createFooBaz )
				.init( function(instance: { qat: RegExp; baz: boolean; foo: string; }) {
					callstack.push('foobazMixinInit');
				});

			createFooBarBazQat();

			assert.deepEqual(callstack, [ 'foobarbazqat', 'foobar', 'foo', 'foobaz', 'foobazMixinInit' ],
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
		'immutability': function (this: any) {
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

		'getters and setters'() {
			const createFoo = compose({
				_foo: '',
				set foo(this: any, foo) {
					this._foo = foo;
				},
				get foo(this: any) {
					return this._foo;
				}
			});

			const foo = createFoo();
			foo.foo = 'bar';

			assert.strictEqual(foo._foo, 'bar', 'Should have used setter and set value');
			assert.strictEqual(foo.foo, 'bar', 'Should use getter and return set value');
		},

		'only getter'() {
			const createFoo = compose({
				_foo: '',
				get foo(this: any) {
					return this._foo + 'bar';
				}
			});

			const foo = createFoo();

			assert.strictEqual(foo.foo, 'bar', 'Should have returned value from getter');
			foo._foo = 'foo';
			assert.strictEqual(foo.foo, 'foobar', 'Getter didn\'t get updated value');
		},

		'only setter'() {
			const createFoo = compose({
				_foo: '',
				set foo(this: any, foo: string) {
					this._foo = foo;
				}
			});

			const foo = createFoo();
			foo.foo = 'bar';

			assert.strictEqual(foo._foo, 'bar', 'Setter should have set value');
			assert.notOk(foo.foo, 'No getter should be defined');
		},

		'non-configurable property'() {
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

		'non-writable property'() {
			const composeObj: { [ index: string ]: string } = {};
			Object.defineProperty(composeObj, 'nonWritable', { value: 'constant', writable: false });
			const createFoo = compose(composeObj);

			const foo = createFoo();

			assert.strictEqual(foo['nonWritable'], 'constant', 'Didn\'t copy property value');

			/* modules are now emitted in strict mode, which causes a throw
			 * when trying to assign to a read-only property */
			assert.throws(() => {
				foo['nonWritable'] = 'variable';
			}, TypeError);
		},

		'non-enumerable property'() {
			const composeObj: { [ index: string ]: string } = {};
			Object.defineProperty(composeObj, 'nonEnumerable', { value: 'value', enumerable: false });
			const createFoo = compose(composeObj);

			const foo = createFoo();
			const fooPrototype = Object.getPrototypeOf(foo);

			assert.strictEqual(foo['nonEnumerable'], 'value', 'Didn\'t copy non-enumerable property');
			assert.notInclude(Object.keys(fooPrototype), 'nonEnumerable', 'Keys included non-enumerable property');
			assert.include(Object.getOwnPropertyNames(fooPrototype), 'nonEnumerable',
				'Own property names did not include non-enumerable property');
		},

		'constructor property not copied'() {
			function constructor() {
				throw new Error('Should not be copied');
			}
			const composeObj = { constructor };
			const createFoo = compose({
				foo: 'bar'
			}).extend(composeObj);
			assert.notStrictEqual(createFoo.prototype.constructor, constructor);
		},

		'array prototype property'() {
			const arr = [ function () { return 'foo'; }, function () { return 'bar'; } ];
			const createFoo = compose({ arr });
			const foo = createFoo();
			assert.isArray(foo.arr);
			assert.notStrictEqual(foo.arr, arr);
			assert.deepEqual(foo.arr, arr);
			assert.deepEqual([ 'foo', 'bar' ], arr.map((value) => value()));
		},

		'getters not accessed during creation': function () {
			let count = 0;
			const createFoo = compose({
				get foo() {
					count++;
					return [];
				}
			});
			const foo = createFoo();
			assert.strictEqual(count, 0);
			assert.isArray(foo.foo);
			assert.strictEqual(count, 1);
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
		'extend with factory'() {
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
		},
		'arrays': {
			'present in base': function () {
				const createFoo = compose.create({
					foo: [ 'bar' ]
				}).extend({
					foo: [ 'baz' ]
				}).extend({
					foo: [ 'qat' ]
				});

				const foo = createFoo();

				assert.deepEqual(foo.foo, [ 'bar', 'baz', 'qat' ]);
			},

			'not present in base': function () {
				const createFoo = compose.create({
					foo: 'bar'
				}).extend({
					bar: [ 'bar' ]
				});

				const foo = createFoo();

				assert.deepEqual(foo.bar, [ 'bar' ]);
			},

			'overwrite in base': function () {
				const createFoo = compose.create({
					foo: 'bar',
					bar: [ 'bar' ]
				}).extend({
					foo: [ 'bar' ],
					bar: 'foo'
				});

				const foo = createFoo();

				assert.deepEqual(foo.foo, [ 'bar' ]);
				assert.deepEqual(foo.bar, 'foo');
			},

			'merging duplicates': function () {
				const createFoo = compose.create({
					foo: [ 'foo', 'bar' ]
				}).extend({
					foo: [ 'bar', 'baz' ]
				});

				const foo = createFoo();

				assert.deepEqual(foo.foo, [ 'foo', 'bar', 'baz' ]);
			},

			'arrays on prototype are not equal': function () {
				const arr1 = [ 'foo', 'bar' ];
				const arr2 = [ 'bar', 'baz' ];
				const createFoo = compose({ arr: arr1 });
				const createBar = createFoo.extend({ arr: arr2 });
				assert.deepEqual(arr1, [ 'foo', 'bar' ]);
				assert.deepEqual(arr2, [ 'bar', 'baz' ]);
				assert.strictEqual(createFoo.prototype.arr, arr1);
				assert.deepEqual(createFoo.prototype.arr, [ 'foo', 'bar' ]);
				assert.deepEqual(createBar.prototype.arr, [ 'foo', 'bar', 'baz' ]);
			}
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

		'Object with factoryDescriptor function'() {
			const createFooBar = compose({
				foo: ''
			}, function(foo: { foo: string }) {
				foo.foo = 'foo';
			}).extend({
				bar: 1
			}).init(function(fooBar: { bar: number; foo: string; }) {
				fooBar.bar = 3;
				fooBar.foo = 'bar';
			});

			const fooBar = createFooBar();
			assert.strictEqual(fooBar.foo, 'bar', 'Foo property not present');
			assert.strictEqual(fooBar.bar, 3, 'Bar property not present');
		},

		'mixing in a class'() {
			class Bar {
				bar() {
					return 'bar';
				}
			}
			const createFooBar = compose({
				foo: 'foo'
			}).mixin({
				mixin: Bar
			});

			const fooBar = createFooBar();
			assert.strictEqual(fooBar.foo, 'foo', 'Foo property not present');
			assert.strictEqual(fooBar.bar(), 'bar', 'Bar property not present');
		},

		'arrays': {
			'present in base': function () {
				const createFoo = compose({
					foo: [ 'foo' ]
				});

				const createBar = compose({
					foo: [ 'bar' ]
				});

				const createBaz = compose({
					foo: [ 'baz' ]
				});

				const createFooBarBaz = createFoo
					.mixin(createBar)
					.mixin(createBaz);

				const foobarbaz = createFooBarBaz();

				assert.deepEqual(foobarbaz.foo, [ 'foo', 'bar', 'baz' ]);
			},

			'not present in base': function () {
				const createFoo = compose({
					foo: 'bar'
				});

				const createBar = compose({
					bar: [ 'bar' ]
				});

				const createFooBar = createFoo.mixin(createBar);

				const foo = createFooBar();

				assert.deepEqual(foo.bar, [ 'bar' ]);
			},

			'overwrite in base': function () {
				const createFoo = compose({
					foo: 'bar',
					bar: [ 'bar' ]
				});

				const createBar = compose({
					foo: [ 'bar' ],
					bar: 'foo'
				});

				const createFooBar = createFoo.mixin(createBar);

				const foo = createFooBar();

				assert.deepEqual(foo.foo, [ 'bar' ]);
				assert.deepEqual(foo.bar, 'foo');
			},

			'merging duplicates': function () {
				const createFoo = compose({
					foo: [ 'foo', 'bar' ]
				});

				const createBar = compose({
					foo: [ 'bar', 'baz' ]
				});

				const createFooBar = createFoo.mixin(createBar);

				const foo = createFooBar();

				assert.deepEqual(foo.foo, [ 'foo', 'bar', 'baz' ]);
			},

			'arrays on prototype are not equal': function () {
				const arr1 = [ 'foo', 'bar' ];
				const arr2 = [ 'bar', 'baz' ];
				const createFoo = compose({ arr: arr1 });
				const createBar = compose({ arr: arr2 });
				const createFooBar = createFoo.mixin(createBar);
				assert.deepEqual(arr1, [ 'foo', 'bar' ]);
				assert.deepEqual(arr2, [ 'bar', 'baz' ]);
				assert.strictEqual(createFoo.prototype.arr, arr1);
				assert.deepEqual(createFoo.prototype.arr, [ 'foo', 'bar' ]);
				assert.deepEqual(createBar.prototype.arr, [ 'bar', 'baz' ]);
				assert.deepEqual(createFooBar.prototype.arr, [ 'foo', 'bar', 'baz' ]);
			}
		}
	},

	override: {
		'.override()'() {
			let count = 0;
			let overrideCount = 0;

			const createFoo = compose.create({
				foo() {
					count++;
				}
			});

			const createOverideFoo = compose.override(createFoo, {
				foo() {
					overrideCount++;
				}
			});

			const foo = createFoo();
			const overrideFoo = createOverideFoo();

			assert.strictEqual(count, 0);
			assert.strictEqual(overrideCount, 0);

			foo.foo();

			assert.strictEqual(count, 1);
			assert.strictEqual(overrideCount, 0);

			overrideFoo.foo();

			assert.strictEqual(count, 1);
			assert.strictEqual(overrideCount, 1);
		},

		'chaining'() {
			let count = 0;
			let overrideCount = 0;

			const createFoo = compose({
					foo() {
						count++;
					}
				})
				.override({
					foo() {
						overrideCount++;
					}
				});

			const foo = createFoo();

			assert.strictEqual(count, 0);
			assert.strictEqual(overrideCount, 0);

			foo.foo();

			assert.strictEqual(count, 0);
			assert.strictEqual(overrideCount, 1);
		},

		'overridding arrays'() {
			const createFoo = compose({
					foo: [ 'foo', 'bar' ]
				})
				.override({
					foo: [ 'baz', 'qat' ]
				});

			const foo = createFoo();

			assert.deepEqual(foo.foo, [ 'baz', 'qat' ], 'Array should be overidden, not merged');
		},

		'className'(this: any) {
			if (!hasToStringTag()) {
				this.skip('Does not natively support Symbol.toStringTag');
			}

			const createFoo = compose('Foo', {
					foo() { }
				})
				.override('Bar', {
					foo() { }
				});

			const foo = createFoo();
			assert.strictEqual((<any> foo).toString(), '[object Bar]');
		},

		'not passing object as properties'() {
			const createFoo = compose({
				foo() { }
			});

			assert.throws(() => {
				createFoo.override('Foo');
			}, TypeError, 'Argument "properties" must be an object.');

			assert.throws(() => {
				createFoo.override(function () {
					return 'foo';
				});
			}, TypeError, 'Argument "properties" must be an object.');
		},

		'missing property in baseFactory'() {
			const createFoo = compose({
				foo () { }
			});

			assert.throws(() => {
				createFoo.override({
					foo() { },
					bar: 2
				});
			}, TypeError, 'Attempting to override missing property "bar"');
		}
	},

	overlay: {
		'.overlay()': function () {
			let count = 0;

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
			'transfer generic type'() {
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

				let fooBarFactory: FooBarClass = compose(Foo).mixin(compose(Bar));

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
					return function(this: any, ...args: any[]): string {
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
					return function(this: any, ...args: any[]): string {
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
					return function(this: any, ...args: any[]): string {
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
								return function(this: any, ...args: any[]): string {
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
				'mixed': function (this: any) {
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
								return function(this: any, ...args: any[]): string {
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
				},
				'original method unmodified'() {
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
							foo(...args: any[]): any[] {
								args[0] = args[0] + 'bar';
								return args;
							}
						},
						after: {
							bar(previousResult: string): string {
								return previousResult + 'bar';
							}
						}
					});

					const foo = createFoo();
					const aspectFoo = createAspectFoo();
					assert.strictEqual(foo.foo('foo'), 'foo', 'original results should be the same');
					assert.strictEqual(aspectFoo.foo('foo'), 'foobar', 'modified method properly returns');
					assert.strictEqual(foo.bar('foo'), 'foo', 'original results should be the same');
					assert.strictEqual(aspectFoo.bar('foo'), 'foobar', 'modified method properly returns');
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
							return function(this: any, ...args: any[]): string {
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
			'multiple advice'() {
				const createFoo = compose({
					foo(a: string): string {
						return a;
					}
				});

				const createAspectFoo = createFoo
					.mixin({
						aspectAdvice: {
							after: {
								foo(previousResult: string): string {
									return previousResult + 'foo';
								}
							}
						}
					});

				createAspectFoo
					.mixin({
						aspectAdvice: {
							after: {
								foo(previousResult: string): string {
									return previousResult + 'bar';
								}
							}
						}
					});

				const foo = createAspectFoo();
				assert.strictEqual(foo.foo('baz'), 'bazfoo', 'should only apply advice in chain');
			},
			'diamond problem'() {
				const createFoo = compose({
					foo(a: string) {
						return a;
					}
				});

				const createBeforeFoo = createFoo
					.aspect({
						before: {
							foo(...args: any[]) {
								args[0] = args[0] + 'foo';
								return args;
							}
						}
					});

				const createFooBar = createFoo
					.mixin({
						mixin: {
							bar: 123
						}
					});

				const createBeforeFooBar = createBeforeFoo
					.mixin(createFooBar);

				const fooBar = createFooBar();
				assert.strictEqual(fooBar.bar, 123);
				assert.strictEqual(fooBar.foo('bar'), 'bar', 'Executes unadvised method');

				const beforeFooBar = createBeforeFooBar();
				assert.strictEqual(beforeFooBar.bar, 123);
				assert.strictEqual(beforeFooBar.foo('bar'), 'barfoo', 'Executes advised method');
			},
			'missing method': function () {
				const createFoo = compose({
					foo: function (a: string): string {
						return a;
					}
				});

				const createBeforeBar = compose.aspect(createFoo, {
					before: {
						bar: function(...args: any[]): any[] {
							args[0] = args[0] + 'bar';
							return args;
						}
					}
				});

				const beforeBar = createBeforeBar();

				assert.throws(function () {
					(<any> beforeBar).bar();
				}, TypeError, `Advice being applied to missing method named: bar`);
			},
			'forward advice'() {
				const createFoo = compose({
					foo: function (a: string): string {
						return a;
					}
				});

				const createBeforeBar = compose.aspect(createFoo, {
					before: {
						bar: function(...args: any[]): any[] {
							args[0] = args[0] + 'bar';
							return args;
						}
					}
				});

				const createBarFoo = createBeforeBar
					.mixin({
						mixin: {
							bar(a: string): string {
								return a;
							}
						}
					});

				const barFoo = createBarFoo();
				assert.strictEqual(barFoo.bar('foo'), 'foobar', 'Executes advised method');
			}
		},
		'static': {
			'create factory with static method'() {
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

			'extend existing factory with static method'() {
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

			'override factory descriptor function with static method'() {
				const createFoo = compose({
					foo: 1
				}).static({
					factoryDescriptor(this: any): ComposeMixinDescriptor<{ foo: number }, any, any, any> {
						return {
							mixin: this
						};
					}
				}).init(function(instance: { foo: number }) {
					instance.foo = 3;
				});

				const createFooBar = compose({
					bar: 1
				}).mixin(createFoo);

				const fooBar = createFooBar();

				assert.strictEqual(fooBar.bar, 1, 'Should have bar property');
				assert.strictEqual(fooBar.foo, 3, 'Should have foo property');
			},

			'Passing a factory to static'() {
				const createFoo = compose({}).static({
					doFoo: (): string => 'foo'
				});

				const createBar = compose({}).static(createFoo);

				assert.strictEqual(createBar.doFoo(), 'foo', 'Should have transferred static property');
			},

			'Passing a factory with no static methods to static'() {
				assert.doesNotThrow(function() {
					compose({}).static(compose({}));
				}, 'Should have handled factory with no static methods without throwing');
			}
		}
	},

	debugging: {
		'getInitFunctionNames'(this: any) {
			if (!hasConfigurableName()) {
				this.skip('Functions do not have configurable names');
			}
			const createFoo = compose('Foo', {
				foo: 'foo'
			}, function () {});
			assert.deepEqual(getInitFunctionNames(createFoo), [ 'initFoo' ]);
			const createBar = compose('Bar', {
				bar: 1
			}, function () {});
			const createFooBar = createFoo.mixin(createBar);
			assert.deepEqual(getInitFunctionNames(createFooBar), [ 'initFoo', 'initBar' ]);
			const createFooBarMixin = createFoo
				.mixin(createBar)
				.init('FooBar', function(instance) {
					instance.bar = 3;
				});
			assert.deepEqual(getInitFunctionNames(createFooBarMixin), [ 'initFoo', 'initBar', 'initFooBar' ]);
			const createFooBarNoClassName = createBar
				.mixin(createFoo)
				.init('FooToo', function(instance) {
					instance.foo = 'bar';
				});
			assert.deepEqual(getInitFunctionNames(createFooBarNoClassName), [ 'initBar', 'initFoo', 'initFooToo' ]);
		},

		'getInitFunctionNames does no throw on environments with non-configurable names'(this: any) {
			if (hasConfigurableName()) {
				this.skip('Only valid for non-configurable function name environments');
			}
			const createFoo = compose('Foo', {
				foo: 'foo'
			}, function () {});
			assert.strictEqual((<any> getInitFunctionNames(createFoo)).length, 1);
			const createBar = compose('Bar', {
				bar: 1
			}, function () {});
			const createFooBar = createFoo.mixin(createBar);
			assert.strictEqual((<any> getInitFunctionNames(createFooBar)).length, 2);
			const createFooBarMixin = createFoo
				.mixin({
					className: 'FooBar',
					mixin: createBar
				})
				.init(function(instance) {
					instance.bar = 3;
				});
			assert.strictEqual((<any> getInitFunctionNames(createFooBarMixin)).length, 3);
			const createFooBarNoClassName = createBar
				.mixin(createFoo)
				.init(function(instance) {
					instance.foo = 'bar';
				});
			assert.strictEqual((<any> getInitFunctionNames(createFooBarNoClassName)).length, 3);
		},

		'getInitFunctionNames returns undefined for unexpected values'(this: any) {
			if (!hasConfigurableName()) {
				this.skip('Functions do not have configurable names');
			}

			assert.isUndefined(getInitFunctionNames(<any> {}), 'Function names should be undefined');
		},

		'instance to string'(this: any) {
			if (!hasToStringTag()) {
				this.skip('Does not natively support Symbol.toStringTag');
			}
			const createFoo = compose('Foo', {});
			const foo = createFoo();
			assert.strictEqual((<any> foo).toString(), '[object Foo]');
			const createFooBar = createFoo
				.mixin({
					className: 'FooBar',
					mixin: {
						bar: 1
					}
				});
			const foobar = createFooBar();
			assert.strictEqual((<any> foobar).toString(), '[object FooBar]');
			const createFooBarNoName = createFoo
				.mixin({
					mixin: {
						bar: 1
					}
				});
			const foobarnoname = createFooBarNoName();
			assert.strictEqual((<any> foobarnoname).toString(), '[object Foo]');
			const createOverrideClassName = createFoo
				.mixin({
					className: 'OverrideClassName'
				});
			const overrideClassName = createOverrideClassName();
			assert.strictEqual((<any> overrideClassName).toString(), '[object OverrideClassName]');
			const createBar = compose({})
				.mixin({
					className: 'Bar',
					mixin: createFoo
				});
			const bar = createBar();
			assert.strictEqual((<any> bar).toString(), '[object Bar]');
			const createExtendedBar = createBar
				.extend('ExtendedBar', {});
			const extendedBar = createExtendedBar();
			assert.strictEqual((<any> extendedBar).toString(), '[object ExtendedBar]');
		},

		'createdMixin to string'(this: any) {
			if (!hasToStringTag()) {
				this.skip('Does not natively support Symbol.toStringTag');
			}
		},

		'unlabelled factories use "Compose"'(this: any) {
			if (!hasToStringTag()) {
				this.skip('Does not natively support Symbol.toStringTag');
			}
			const createEmpty = compose({});
			const empty = createEmpty();
			assert.strictEqual((<any> empty).toString(), '[object Compose]');
		},

		'factories "inherit" names when not supplied'(this: any) {
			if (!hasToStringTag()) {
				this.skip('Does not natively support Symbol.toStringTag');
			}
			const createStatic = compose('Static', {})
				.static({
					foo: 'bar'
				});

			const s = createStatic();
			assert.strictEqual((<any> s).toString(), '[object Static]');
		}
	},
	createMixin: {
		'basic'() {
			const bar = compose.createMixin()
				.extend({
					bar: 'bar'
				});
				// .target({foo: ''});
			const createFooBar = compose({
				foo: 'foo'
			}).mixin(bar);

			const fooBar = createFooBar();

			assert.strictEqual(fooBar.foo, 'foo');
			assert.strictEqual(fooBar.bar, 'bar');
		},

		'test assertion'() {
			type Bar = { bar: string };
			type BarOptions = { bar: string };
			const bar: ComposeCreatedMixin<{foo: string}, {bar: string} & {bar: string}, {bar: string} & {}, {}>  =
				compose.createMixin<{ foo: string }, Bar, BarOptions, {}>()
					.extend({
						bar: 'bar'
					}
			);

			const createFooBar = compose({
				foo: 'foo'
			}).mixin(bar);
			// Shouldn't compile, wrong target type but does. If
			// target is added, then neither of these compile.
			// const createBazBar = compose<{baz: string}, any>({
			// 	baz: 'baz'
			// }).mixin(bar);
			const createBazBar = compose<{baz: string, foo: string}, any>({
				baz: 'baz',
				foo: 'foo'
			}).mixin(bar);
			assert.strictEqual(createFooBar().bar, createBazBar().bar);
			// assert.notOk(createBazBar().foo);
		},

		'chained extensions'() {
			const fooBarBaz = compose({})
				.mixin(compose.createMixin()
					.extend({
						foo: 'foo'
					})
					.extend({
						bar: 'bar'
					})
					.extend({
						baz: 'baz'
					})
				)();
			assert.strictEqual(fooBarBaz.foo, 'foo');
			assert.strictEqual(fooBarBaz.bar, 'bar');
			assert.strictEqual(fooBarBaz.baz, 'baz');
		},

		'add init function'() {
			interface Bar {
				bar: string;
			}
			interface Foo {
				foo: string;
			}
			const createFoo = compose({
				foo: 'original value'
			}, function(instance, options?: { foo: string }) {
				instance.foo = 'initialized value';
			});

			const bar = compose.createMixin(createFoo)
				.extend({
					bar: 'bar'
				})
				.init((instance: Foo & Bar, options?: Foo & Bar) => {
					if (options) {
						instance.bar = options.bar;
						instance.foo = options.foo;
					}
				});

			const createFooBar = createFoo.mixin(bar);

			const fooBar = createFooBar({
				foo: 'final value',
				bar: 'new value'
			});

			assert.strictEqual(fooBar.foo, 'final value');
			assert.strictEqual(fooBar.bar, 'new value');
		},

		'compose factory and initialize'() {
			const createBar = compose.createMixin()
				.extend({
					bar: 2
				}).init(function(instance: any) {
					// This runs second,
					instance.foo = 'bar';
					assert.strictEqual(instance.bar, 3, 'instance missing bar');
				});

			const createFooBar = compose({
				foo: 'foo',
				baz: ''
			}, function(instance: any) {
				// This runs first, and shouldn't expect anything from subsequent mixins
				instance.bar = 3;
				assert.strictEqual(instance.baz, '', 'instance contains baz');
			})
				.mixin(createBar)
				.init(function(instance: any) {
					// This runs third, as it's the new, optional initialize provided with the mixin
					assert.strictEqual(instance.foo, 'bar', 'instance contains foo');
					instance.baz = 'baz';
				});

			const foobar = createFooBar();
			assert.strictEqual(foobar.baz, 'baz', 'instance contains baz');
		},
		'base, initialize, and aspect'() {
			const createFooMixin = compose.createMixin()
				.extend({
					foo: 'foo',
					bar: '',
					doneFoo: false,
					doFoo: function(this: any) {
						this.foo = 'bar';
					}
				})
				.init(function(instance: any) {
					instance.bar = 'bar';
				}).aspect({
					after: {
						doFoo: function(this: any) {
							this.doneFoo = true;
						}
					}
				});

			const createFoo = compose({}).mixin(createFooMixin);
			const foo = createFoo();
			assert.strictEqual(foo.foo, 'foo', 'contains foo property');
			assert.strictEqual(foo.bar, 'bar', 'initialize ran');

			foo.doFoo();
			assert.strictEqual(foo.foo, 'bar', 'ran function');
			assert.isTrue(foo.doneFoo, 'ran aspect');
		},

		'Init function with combined types'() {
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
			createBar
				.mixin(createBaz)
				.init(function(instance: { bar: string; baz: number }, options: { bar: string; baz: number }) {

				});
			/* Doesn't compile with new flow control typing, which maybe is a good thing? */
			// createBar.mixin({
			// 	initialize: function(instance: { baz: number }, options: { baz: number }) {

			// 	},
			// 	mixin: createBaz
			// });
			// createBar.mixin({
			// 	initialize: function(instance: { bar: string }, options: { bar: string }) {

			// 	},
			// 	mixin: createBaz
			// });
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

		'inferring init types'() {
			const fooBar = compose.createMixin()
				.extend({
					foo: 'foo'
				})
				.init((instance) => {
					instance.foo = 'newfoo';
				})
				.extend({
					bar: 'bar'
				})
				.init((instance) => {
					instance.foo = instance.bar = 'newfooandbar';
				});

			const createBaz = compose({
				baz: 'baz'
			});
			const createFooBarBaz = createBaz
				.mixin(fooBar)
				.init((instance) => {
					instance.bar = instance.baz = instance.foo = 'newfoobarbaz';
				});
			assert.strictEqual(createBaz().baz, 'baz', 'Wrong value on simple factory');
			assert.strictEqual(createFooBarBaz().foo, 'newfoobarbaz', 'Wrong value on combination');
		},

		'multiple advice'() {
			const createFoo = compose({
				foo(a: string): string {
					return a;
				}
			});

			const createAspectFoo = createFoo
				.mixin(compose.createMixin()
					.aspect({
						after: {
							foo(previousResult: string): string {
								return previousResult + 'foo';
							}
						}
					})
				);

			createAspectFoo
				.mixin(compose.createMixin()
					.aspect({
						after: {
							foo(previousResult: string): string {
								return previousResult + 'bar';
							}
						}
					})
				);

			const foo = createAspectFoo();
			assert.strictEqual(foo.foo('baz'), 'bazfoo', 'should only apply advice in chain');
		},

		'static'() {
			const staticMixin = compose.createMixin().static({ foo: 'foo' });
			const createStaticFoo = compose({}).mixin(staticMixin);

			assert.strictEqual(createStaticFoo.foo, 'foo', 'Didn\'t apply static property to factory correctly');
		},

		'mixin'() {
			const createFoo = compose({
				foo: 'foo'
			}, (instance) => {
				instance.foo = 'newFoo';
			});
			const barMixin = compose.createMixin()
				.extend({
					bar: 'bar'
				})
				.init((instance) => {
					instance.bar = 'newBar';
				});
			const mixinsMixin = compose.createMixin()
				.mixin(createFoo)
				.mixin(barMixin);

			const createFooBarBaz = compose({
					baz: 'baz'
				}, (instance) => {
					instance.baz = 'newBaz';
				})
				.mixin(mixinsMixin);
			const fooBarBaz = createFooBarBaz();

			assert.strictEqual(fooBarBaz.foo, 'newFoo');
			assert.strictEqual(fooBarBaz.bar, 'newBar');
			assert.strictEqual(fooBarBaz.baz, 'newBaz');
		},

		'overlay'() {
			const createFoo = compose({
				foo: 'foo'
			});

			// Provide target argument to infer base type without
			// specifying generics
			const overlayMixin = compose.createMixin(createFoo)
				.overlay((proto) => {
					proto.foo = 'bar';
				});

			assert.strictEqual(createFoo.mixin(overlayMixin)().foo, 'bar', 'Didn\'t apply overlay function properly');
		},

		'override'() {
			const createFoo = compose({
				foo: 'foo'
			});

			const overrideMixin = compose.createMixin()
				.override({
					foo: 'bar'
				});

			assert.strictEqual(createFoo.mixin(overrideMixin)().foo, 'bar');
		},

		'from'() {
			class Foo {
				bar: string;
				foo(): string {
					return this.bar;
				}
			}

			const fromFooMixin = compose.createMixin()
				.from(Foo, 'foo');

			const createFooBar = compose({
				bar: 'qat',
				foo: function (): string { return 'foo'; }
			}).mixin(fromFooMixin);

			const foobar = createFooBar();
			assert.strictEqual(foobar.foo(), 'qat', 'Return from ".foo()" should equal "qat"');
		},

		'before'() {
			function advice(...args: any[]): any[] {
				args[0] = args[0] + 'bar';
				return args;
			}

			const createFoo = compose({
				foo: (foo: string) => foo
			});
			const plusBarMixin = compose.createMixin()
				.before('foo', advice);

			const foobar = createFoo.mixin(plusBarMixin)();
			const result = foobar.foo('foo');
			assert.strictEqual(result, 'foobar', '"result" should equal "foobar"');
		},

		'after'() {
			function advice(result: string, ...args: any[]): string {
				return result + 'bar';
			}

			const createFoo = compose({
				foo: () => 'foo'
			});

			const plusBarMixin = compose.createMixin()
				.after('foo', advice);
			const foobar = createFoo.mixin(plusBarMixin)();
			const result = foobar.foo();
			assert.strictEqual(result, 'foobar', '"result" should equal "foobar"');
		},

		'around'() {
			function advice(original: (...args: any[]) => any) {
				return (...args: any[]) => 'foo' + original(...args) + 'baz';
			}

			const createBar = compose({
				bar: (bar: string) => bar
			});
			const aroundMixin = compose.createMixin()
				.around('bar', advice);
			const foobarbaz = createBar.mixin(aroundMixin)();
			const result = foobarbaz.bar('bar');
			assert.strictEqual(result, 'foobarbaz', '"result" should equal "foobarbaz"');
		}
	}
});
