import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { hasToStringTag } from '../../support/util';
import eventedMixin from '../../../src/bases/eventedMixin';
import compose from '../../../src/compose';

const createEvented = compose({}).mixin(eventedMixin);
registerSuite({
	name: 'mixins/eventedMixin',
	creation() {
		const evented = createEvented();
		assert(evented);
		assert.isFunction(evented.on);
		assert.isFunction(evented.emit);
	},
	'listeners at creation'() {
		const eventStack: string[] = [];
		const evented = createEvented({
			listeners: {
				'foo'(event) {
					eventStack.push(event.type);
				},
				'bar'(event) {
					eventStack.push(event.type);
				}
			}
		});

		evented.emit({ type: 'foo' });
		evented.emit({ type: 'bar' });
		evented.emit({ type: 'baz' });

		evented.destroy();

		evented.emit({ type: 'foo' });
		evented.emit({ type: 'bar' });
		evented.emit({ type: 'baz' });

		assert.deepEqual(eventStack, [ 'foo', 'bar' ]);
	},
	'listener array at creation'() {
		const eventStack: string[] = [];
		const evented = createEvented({
			listeners: {
				foo: [
					function (event) {
						eventStack.push('foo1-' + event.type);
					},
					function (event) {
						eventStack.push('foo2-' + event.type);
					}
				],
				bar(event) {
					eventStack.push(event.type);
				}
			}
		});

		evented.emit({ type: 'foo' });
		evented.emit({ type: 'bar' });

		evented.destroy();

		evented.emit({ type: 'foo' });
		evented.emit({ type: 'bar' });

		assert.deepEqual(eventStack, [ 'foo1-foo', 'foo2-foo', 'bar' ]);
	},
	'on': {
		'on()'() {
			const eventStack: string[] = [];
			const evented = createEvented();
			const handle = evented.on('foo', (event) => {
				eventStack.push(event.type);
			});

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'bar' });

			handle.destroy();

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'bar' });

			assert.deepEqual(eventStack, [ 'foo' ]);
		},
		'listener on creation, plus on'() {
			const eventStack: string[] = [];
			const evented = createEvented({
				listeners: {
					foo(event) {
						eventStack.push('listener:' + event.type);
					}
				}
			});

			const handle = evented.on('foo', (event) => {
				eventStack.push('on:' + event.type);
			});

			evented.emit({ type: 'foo' });
			handle.destroy();
			evented.emit({ type: 'foo' });
			evented.destroy();
			evented.emit({ type: 'foo' });

			assert.deepEqual(eventStack, [ 'listener:foo', 'on:foo', 'listener:foo' ]);
		},
		'multiple listeners, same event'() {
			const eventStack: string[] = [];
			const evented = createEvented();

			const handle1 = evented.on('foo', () => {
				eventStack.push('one');
			});
			const handle2 = evented.on('foo', () => {
				eventStack.push('two');
			});

			evented.emit({ type: 'foo' });
			handle1.destroy();
			evented.emit({ type: 'foo' });
			handle2.destroy();
			evented.emit({ type: 'foo' });

			assert.deepEqual(eventStack, [ 'one', 'two', 'two' ]);
		},
		'on(map)'() {
			const eventStack: string[] = [];
			const evented = createEvented();

			const handle = evented.on({
				foo(event) {
					eventStack.push(event.type);
				},
				bar(event) {
					eventStack.push(event.type);
				}
			});

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'bar' });
			handle.destroy();
			evented.emit({ type: 'foo' });
			evented.emit({ type: 'bar' });

			assert.deepEqual(eventStack, [ 'foo', 'bar' ]);
		},
		'on(type, listener[])'() {
			const eventStack: string[] = [];
			const evented = createEvented();

			const handle = evented.on({
				foo: [
					function (event) {
						eventStack.push('foo1');
					},
					function (event) {
						eventStack.push('foo2');
					}
				]
			});

			evented.emit({ type: 'foo' });
			handle.destroy();
			evented.emit({ type: 'foo' });

			assert.deepEqual(eventStack, [ 'foo1', 'foo2' ]);
		},
		'on throws'() {
			const evented = createEvented();
			assert.throws(() => {
				(<any> evented).on();
			}, TypeError);
			assert.throws(() => {
				(<any> evented).on('type', () => {}, () => {});
			}, TypeError);
		}
	},
	'wildcards in event type name': {
		'all event types'() {
			const eventStack: string[] = [];
			const evented = createEvented();
			evented.on('*', (event) => {
				eventStack.push(event.type);
			});

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'bar' });
			evented.emit({ type: 'foo:bar' });

			assert.deepEqual(eventStack, [ 'foo', 'bar', 'foo:bar' ]);
		},
		'event types starting with a pattern'() {
			const eventStack: string[] = [];
			const evented = createEvented();
			evented.on('foo:*', (event) => {
				eventStack.push(event.type);
			});

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'foo:' });
			evented.emit({ type: 'foo:bar' });

			assert.deepEqual(eventStack, [ 'foo:', 'foo:bar' ]);
		},
		'event types ending with a pattern'() {
			const eventStack: string[] = [];
			const evented = createEvented();
			evented.on('*:bar', (event) => {
				eventStack.push(event.type);
			});

			evented.emit({ type: 'bar' });
			evented.emit({ type: ':bar' });
			evented.emit({ type: 'foo:bar' });

			assert.deepEqual(eventStack, [ ':bar', 'foo:bar' ]);
		},
		'event types contains a pattern'() {
			const eventStack: string[] = [];
			const evented = createEvented();
			evented.on('*foo*', (event) => {
				eventStack.push(event.type);
			});

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'foobar' });
			evented.emit({ type: 'barfoo' });
			evented.emit({ type: 'barfoobiz' });

			assert.deepEqual(eventStack, [ 'foo', 'foobar', 'barfoo', 'barfoobiz' ]);
		},
		'multiple matches'() {
			const eventStack: string[] = [];
			const evented = createEvented();
			evented.on('foo', (event) => {
				eventStack.push(`foo->${event.type}`);
			});
			evented.on('*foo', (event) => {
				eventStack.push(`*foo->${event.type}`);
			});

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'foobar' });
			evented.emit({ type: 'barfoo' });

			assert.deepEqual(eventStack, [ 'foo->foo', '*foo->foo', '*foo->barfoo' ]);
		}
	},
	'actions': {
		'listener'() {
			const eventStack: string[] = [];
			const action = {
				do(options: { event: { type: string; target: any; } }): void {
					eventStack.push(options.event.type);
				}
			};

			const evented = createEvented({
				listeners: {
					foo: action
				}
			});

			const handle = evented.on('bar', action);

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'bar' });
			evented.emit({ type: 'baz' });

			evented.destroy();

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'bar' });
			evented.emit({ type: 'baz' });

			handle.destroy();

			evented.emit({ type: 'foo' });
			evented.emit({ type: 'bar' });
			evented.emit({ type: 'baz' });

			assert.deepEqual(eventStack, [ 'foo', 'bar', 'bar' ]);
		}
	},
	'toString()'(this: any) {
		if (!hasToStringTag()) {
			this.skip('Environment doesn\'t support Symbol.toStringTag');
		}
		const evented = createEvented();
		assert.strictEqual((<any> evented).toString(), '[object Evented]');
	}
});
