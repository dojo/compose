import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import createEvented from 'src/mixins/createEvented';

registerSuite({
	name: 'mixins/createEvented',
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
		}
	},
	'actions': {
		'listener'() {
			const eventStack: string[] = [];
			const action = {
				do(options: { event: { type: string; } }): void {
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
	}
});
