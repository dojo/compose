import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { before, after, around } from '../../src/aspect';

registerSuite({
	name: 'lib/aspect',
	'before advice': {
		'adjust arguments': function () {
			let result = 0;
			function foo(a: number) {
				result = a;
			}

			function advice(a: number) {
				return [ a * a ];
			}

			const fn = before(foo, advice);

			fn(2);

			assert.strictEqual(result, 4, '"result" should equal 4');
		},
		'passes this': function () {
			let result = 0;
			function foo(this: any) {
				result = this.a;
			}

			function advice(this: any) {
				this.a = 2;
			}

			const fn = before(foo, advice);
			const context = { a: 0 };
			fn.call(context);
			assert.strictEqual(context.a, 2, 'context.a should equal 2');
			assert.strictEqual(result, 2, 'result should equal 2');
		},
		'multiple before advice': function () {
			let result = 0;
			const calls: string[] = [];
			function foo(a: number) {
				result = a;
			}

			function advice1(...args: any[]) {
				calls.push('1');
				args[0] = args[0] + args[0];
				return args;
			}

			function advice2(a: number) {
				calls.push('2');
				return [ ++a ];
			}

			const fn = before(before(foo, advice1), advice2);
			fn(2);
			assert.strictEqual(result, 6, '"result" should equal 5');
			assert.deepEqual(calls, [ '2', '1' ], 'advice should be called in order');
		}
	},
	'after advice': {
		'adjust return value': function () {
			function foo(a: number) {
				return a;
			}

			function advice(prevResult: number, ...args: any[]) {
				return prevResult * args[0];
			}

			const fn = after(foo, advice);

			const result = fn(2);

			assert.strictEqual(result, 4, '"result" should equal 4');
		},
		'passes this': function () {
			function foo(this: any) {
				return this.a;
			}

			function advice(this: any, prevResult: number) {
				this.c = prevResult + this.b;
				return this.c;
			}

			const fn = after(foo, advice);
			const context = { a: 2, b: 2, c: 0 };
			const result = fn.call(context);
			assert.strictEqual(result, 4, '"result" should equal 4');
			assert.strictEqual(context.c, 4, '"context.c" should equal 4');
		},
		'multiple after advice': function () {
			const calls: string[] = [];
			function foo(a: number): number {
				return a;
			}

			function advice1(prevResult: number, ...args: any[]) {
				calls.push('1');
				return prevResult + args[0];
			}

			function advice2(prevResult: number, ...args: any[]) {
				calls.push('2');
				return prevResult + args[0] + 1;
			}

			let fn = after(foo, advice1);
			fn = after(fn, advice2);
			const result = fn(2);
			assert.strictEqual(result, 7, '"result" should equal 7');
			assert.deepEqual(calls, [ '1', '2' ], 'call should have been made in order');
		}
	},
	'around advice': {
		'basic function': function () {
			function foo(a: number): number {
				return a;
			}

			function advice(origFn: Function): (...args: any[]) => number {
				return function(this: any, ...args: any[]): number {
					args[0] = args[0] + args[0];
					let result = origFn.apply(this, args);
					return ++result;
				};
			}

			const fn = around(foo, advice);
			const result = fn(2);
			assert.strictEqual(result, 5, '"result" should equal 5');
		},
		'preserves this': function () {
			function foo(this: any, a: number): number {
				return this.a;
			}

			function advice(origFn: Function): (...args: any[]) => number {
				return function(this: any, ...args: any[]): number {
					this.a = 2;
					return origFn.apply(this, args);
				};
			}

			const context = { a: 2 };
			const fn = around(foo, advice);
			const result = fn.apply(context);
			assert.strictEqual(result, 2, '"result" should equal 2');
		},
		'multiple around advice': function () {
			const calls: string[] = [];
			function foo(a: number): number {
				return a;
			}

			function advice1(origFn: Function): (...args: any[]) => number {
				return function (this: any, ...args: any[]): number {
					calls.push('1');
					args[0]++;
					return origFn.apply(this, args) + 1;
				};
			}

			function advice2(origFn: Function): (...args: any[]) => number {
				return function (this: any, ...args: any[]): number {
					calls.push('2');
					args[0] += args[0];
					return origFn.apply(this, args) + 1;
				};
			}

			const fn = around(around(foo, advice1), advice2);
			const result = fn(2);
			assert.strictEqual(result, 7, '"result" should equal 7');
			assert.deepEqual(calls, [ '2', '1' ]);
		}
	},
	'combined advice': {
		'before and after': function () {
			function foo(a: number): number {
				return a + a;
			}

			function adviceBefore(...args: any[]): any[] {
				args[0] = args[0] + args[0];
				return args;
			}

			function adviceAfter(origResult: number, ...args: any[]): number {
				return origResult + args[0] + 1;
			}

			let fn = after(foo, adviceAfter);
			fn = before(fn, adviceBefore);
			const result = fn(2);
			assert.strictEqual(result, 13, '"result" should equal 13');
		}
	},
	'chained advice'() {
		function foo(a: string): string {
			return a;
		}

		function adviceAfter(origResult: string): string {
			return origResult + 'foo';
		}

		const fn = after(after(foo, adviceAfter), adviceAfter);
		after(fn, adviceAfter);
		assert.strictEqual(fn('bar'), 'barfoofoo', 'should only apply advice twice');
	}
});
