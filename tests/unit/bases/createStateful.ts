import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { hasToStringTag } from '../../support/util';
import Promise from 'dojo-shim/Promise';
import { State } from 'dojo-interfaces/bases';
import { Observable, Observer } from 'rxjs/Rx';
import createStateful from '../../../src/bases/createStateful';

registerSuite({
	name: 'mixins/createStateful',
	creation: {
		'no options'() {
			const stateful = createStateful();
			assert.isUndefined(stateful.stateFrom);
			assert.deepEqual(stateful.state, {}, 'stateful should have empty state');
			assert.isFunction(stateful.setState, 'stateful should have `setState` function');
		},
		'with state'() {
			const stateful = createStateful({
				state: { foo: 'bar' }
			});
			assert.deepEqual(stateful.state.foo, 'bar', 'state should have been set');
		},
		'with id and stateFrom'() {
			let called = 0;
			const observer = {
				observe(id: string): Observable<State> {
					called++;
					return new Observable(function subscribe(observer: Observer<State>) {
						observer.next({ foo: 'bar' });
						observer.complete();
					});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					assert.strictEqual(options && options.id, 'foo');
					return Promise.resolve(value);
				}
			};

			const stateful = createStateful<{ foo?: string; }>({
				id: 'foo',
				stateFrom: observer
			});

			assert.strictEqual(called, 1);
			assert.equal(stateful.stateFrom, observer);
			assert.deepEqual(stateful.state, { foo: 'bar' });
		},
		'with id of 0'() {
			/* while the interface specifies a string for an ID, real world usage may very well pass
			 * a numeric ID which will eventually get coerced into a string, therefore the number of
			 * 0 should be halnded gracefully */
			let called = 0;
			const observer = {
				observe(id: string): Observable<State> {
					called++;
					return new Observable(function subscribe(observer: Observer<State>) {
						observer.next({ foo: 'bar' });
						observer.complete();
					});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					assert.strictEqual(options && options.id, 0);
					return Promise.resolve(value);
				}
			};

			const stateful = createStateful<{ foo?: string; }>({
				id: <any> 0,
				stateFrom: observer
			});

			assert.strictEqual(called, 1);
			assert.deepEqual(stateful.state, { foo: 'bar' });
		},
		'with only stateForm throws'() {
			const observer = {
				observe(id: string): Observable<State> {
					return new Observable(() => {});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					return Promise.resolve(value);
				}
			};

			assert.throws(() => {
				createStateful({
					stateFrom: observer
				});
			}, TypeError);
		}
	},
	'destroy()'() {
		const observer = {
			observe(id: string): Observable<State> {
				return new Observable(function subscribe(observer: Observer<State>) {
					observer.next({ foo: 'bar' });
					observer.complete();
				});
			},
			patch(value: any, options?: { id?: string }): Promise<State> {
				throw Error('Should not have been called!');
			}
		};

		const stateful = createStateful<{ foo?: string; }>({
			id: 'foo',
			stateFrom: observer
		});

		stateful.destroy();

		assert.isUndefined(stateful.state);

		assert.throws(() => {
			stateful.setState({ foo: 'bar' });
		}, Error);
	},
	'setState'() {
		const stateful = createStateful();
		stateful.setState({
			bar: 'foo'
		});

		assert.deepEqual(stateful.state, { bar: 'foo' });
		stateful.setState({
			foo: 1
		});
		assert.deepEqual(stateful.state, { foo: 1, bar: 'foo' });
		const state = {
			foo: [ { foo: 'bar' }, { foo: 'baz' } ]
		};
		stateful.setState(state);
		assert.notStrictEqual((<any> stateful.state).foo, state.foo, 'state should not be strict equal');
		assert.deepEqual((<any> stateful.state).foo, state.foo, 'state should be deeply equal');
		stateful.setState({ bar: undefined });
		assert.isUndefined((<any> stateful.state).bar, 'bar is undefined');
		state.foo.push({ foo: 'qat' });
		assert.strictEqual((<any> stateful.state).foo.length, 2, 'state should remain untouched');
	},
	'observe state': {
		'observeState()'() {
			let called = 0;
			let patchCalled = 0;
			let observerRef: Observer<State>;
			const observer = {
				observe(id: string): Observable<State> {
					assert.strictEqual(id, 'foo');
					called++;
					return new Observable(function subscribe(observer: Observer<State>) {
						observerRef = observer;
						observerRef.next({ foo: 'bar' });
					});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					patchCalled++;
					observerRef.next(value);
					assert.strictEqual(options && options.id, 'foo');
					return Promise.resolve(value);
				}
			};

			const stateful = createStateful();

			stateful.observeState('foo', observer);
			assert.strictEqual(called, 1);
			assert.strictEqual(patchCalled, 0);
			assert.deepEqual(stateful.state, { foo: 'bar' });

			observer.patch({ foo: 'qat' }, { id: 'foo' });
			assert.strictEqual(called, 1);
			assert.strictEqual(patchCalled, 1);
			assert.deepEqual(stateful.state, { foo: 'qat' });

			stateful.setState({ foo: 'foo'});
			assert.strictEqual(called, 1);
			assert.strictEqual(patchCalled, 2);
			assert.deepEqual(stateful.state, { foo: 'foo' });
		},
		'observeState() - completed/destroyed'() {
			let called = 0;
			let destroyed = 0;
			let observerRef: Observer<State> = <any> undefined;
			const observer = {
				observe(id: string): Observable<State> {
					assert.strictEqual(id, 'foo');
					return new Observable(function subscribe(observer: Observer<State>) {
						observerRef = observer;
						observerRef.next({ foo: 'bar' });
					});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					throw new Error('Should not have been called');
				}
			};

			const stateful = createStateful();

			stateful.own({
				destroy() {
					destroyed++;
				}
			});

			stateful.on('state:completed', (evt) => {
				called++;
				assert.strictEqual(evt.target, stateful);
			});

			stateful.observeState('foo', observer);
			assert.deepEqual(stateful.state, { foo: 'bar' });

			assert.strictEqual(called, 0);
			assert.strictEqual(destroyed, 0);

			observerRef.complete();

			assert.strictEqual(called, 1);
			assert.strictEqual(destroyed, 1);

			assert.throws(() => {
				stateful.setState({ foo: 'qat' });
			});
		},
		'observeState() - completed but preventDefaut'() {
			let called = 0;
			let destroyed = 0;
			let observerRef: Observer<State> = <any> undefined;
			const observer = {
				observe(id: string): Observable<State> {
					assert.strictEqual(id, 'foo');
					return new Observable(function subscribe(observer: Observer<State>) {
						observerRef = observer;
						observerRef.next({ foo: 'bar' });
					});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					throw new Error('Should not have been called');
				}
			};

			const stateful = createStateful();

			stateful.own({
				destroy() {
					destroyed++;
				}
			});

			stateful.on('state:completed', (evt) => {
				called++;
				assert.strictEqual(evt.target, stateful);
				evt.preventDefault();
			});

			stateful.observeState('foo', observer);
			assert.deepEqual(stateful.state, { foo: 'bar' });

			assert.strictEqual(called, 0);
			assert.strictEqual(destroyed, 0);

			observerRef.complete();

			assert.strictEqual(called, 1);
			assert.strictEqual(destroyed, 0);

			stateful.setState({ foo: 'qat' });
			assert.deepEqual(stateful.state, { foo: 'qat' });
			assert.strictEqual(called, 1);
			assert.strictEqual(destroyed, 0);
		},
		'observeState() - error'() {
			const observer = {
				observe(id: string): Observable<State> {
					return new Observable(function subscribe(observer: Observer<State>) {
						observer.error(new Error('Ooops...'));
					});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					return Promise.resolve(value);
				}
			};

			const stateful = createStateful();

			assert.throws(() => {
				stateful.observeState('foo', observer);
			}, Error, 'Ooops...');
		},
		'observeState() - again'() {
			const observer1 = {
				observe(id: string): Observable<State> {
					return new Observable(() => {});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					return Promise.resolve(value);
				}
			};

			const observer2 = {
				observe(id: string): Observable<State> {
					return new Observable();
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					return Promise.resolve(value);
				}
			};

			const stateful = createStateful({
				id: 'foo',
				stateFrom: observer1
			});

			const handle = stateful.observeState('foo', observer1);

			assert(handle);

			assert.strictEqual(stateful.observeState('foo', observer1), handle, 'same handle should be returned');

			assert.throws(() => {
				stateful.observeState('bar', observer1);
			}, Error);

			assert.throws(() => {
				stateful.observeState('foo', observer2);
			}, Error);
		},
		'observeState() - destroy handle'() {
			let observerRef: Observer<State>;
			const observer = {
				observe(id: string): Observable<State> {
					return new Observable(function subscribe(observer: Observer<State>) {
						observerRef = observer;
						observerRef.next({ foo: 'bar' });
					});
				},
				patch(value: any, options?: { id?: string }): Promise<State> {
					observerRef.next(value);
					return Promise.resolve(value);
				}
			};

			const stateful = createStateful();

			const handle = stateful.observeState('foo', observer);
			assert.deepEqual(stateful.state, { foo: 'bar' });

			handle.destroy();
			observer.patch({ foo: 'qat' }, { id: 'foo' });
			assert.deepEqual(stateful.state, { foo: 'bar' });

			assert.doesNotThrow(() => {
				handle.destroy();
			});
		}
	},
	'"state:changed" event type': {
		'local state'() {
			let count = 0;
			interface TestState {
				foo?: string;
			}

			const stateful = createStateful<TestState>({
				state: {
					foo: 'foo'
				}
			});

			stateful.on('state:changed', (event) => {
				count++;
				assert.strictEqual(event.target, stateful);
				assert.strictEqual(event.type, 'state:changed');
				assert.deepEqual(event.state, { foo: 'bar' });
				assert.strictEqual(event.state, event.target.state);
			});

			assert.strictEqual(count, 0, 'listener not called yet');

			stateful.setState({ foo: 'bar' });

			assert.strictEqual(count, 1, 'listener called once');
		},
		'observed state'() {
			let count = 0;
			let patchCount = 0;

			interface TestState {
				foo?: string;
			}

			let observerRef: Observer<TestState>;

			const observer = {
				observe(id: string): Observable<TestState> {
					return new Observable(function subscribe(observer: Observer<TestState>) {
						observerRef = observer;
						observerRef.next({ foo: 'bar' });
					});
				},
				patch(value: any, options?: { id?: string }): Promise<TestState> {
					patchCount++;
					observerRef.next(value);
					return Promise.resolve(value);
				}
			};

			const stateful = createStateful({
				id: 'foo',
				stateFrom: observer,
				listeners: { 'state:changed'() { count++; } }
			});

			assert.deepEqual(stateful.state, { foo: 'bar' });

			assert.strictEqual(count, 1, 'listener not called');

			const state = { foo: 'qat' };
			stateful.setState(state);

			assert.strictEqual(patchCount, 1, 'patch should have been called');
			assert.deepEqual(stateful.state, state);
			assert.strictEqual(count, 2, 'listener called');
		}
	},
	'toString()'(this: any) {
		if (!hasToStringTag()) {
			this.skip('Environment doesn\'t support Symbol.toStringTag');
		}
		const stateful: any = createStateful();
		assert.strictEqual(stateful.toString(), '[object Stateful]');
	}
});
