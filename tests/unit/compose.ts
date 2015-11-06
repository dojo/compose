import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import compose, { GenericClass } from '../../src/compose';

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

			function initFoo() {
				this.foo();
			}

			const createFoo = compose(Foo, initFoo);

			const foo = createFoo();
			assert.strictEqual(counter, 1, 'the initialisation function fired');
		},
		'initialise function with prototype': function () {
			let counter = 0;

			function initFoo() {
				this.foo();
				this.bar = 'foo';
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

			const createFoo = compose(<GenericClass< { foo(): void; bar: string; } >> <any> Foo, initFoo);
			const foo = createFoo({ bar: 'baz' });
			assert.strictEqual(counter, 1, 'counter only called once');
			assert.strictEqual(foo.bar, 'foo', 'bar is initialised to foo');
			assert.instanceOf(foo, createFoo, 'foo is an instanceOf Foo');
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
				foo() {
					return 'bar';
				}
			});

			assert.throws(function () {
				const foo = new (<any> createFoo)();
			}, SyntaxError, 'Factories cannot be called with "new"');
		},
		'immutability': function () {
			'use strict';
			const createFoo = compose({
				foo() {
					return 'bar';
				}
			});

			assert.throws(function () {
				(<any> createFoo).bar = 'qat';
			}, TypeError, 'object is not extensible');
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
			assert.strictEqual(foobar.bar, 2, 'instance contains foo');
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

			const createFooBar = compose.mixin(createFoo, Bar);

			const foobar = createFooBar();

			assert.strictEqual(foobar.foo, 'foo', 'instance contains foo');
			assert.strictEqual(foobar.bar(), 2, 'instance contains bar');
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
			const fooOverlayed2 = createFooOverlayed();

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
				}, Error, 'Trying to advise non-existing method: "bar"');
			}
		}
	}
});
