import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { hasToStringTag } from '../../support/util';
import createDestroyable, { isDestroyable } from '../../../src/bases/createDestroyable';

registerSuite({
	name: 'mixins/createDestroyable',
	'own/destroy handle'() {
		let count = 0;

		const destroyable = createDestroyable();
		destroyable.own({
			destroy() {
				count++;
			}
		});

		assert.strictEqual(count, 0, 'handle should not be called yet');
		return destroyable.destroy().then(() => {
			assert.strictEqual(count, 1, 'handle should have been called');
			return destroyable.destroy().then(() => {
				assert.strictEqual(count, 1, 'handle should not have been called again');
			});
		});
	},
	'own after destruction throws'() {
		const destroyable = createDestroyable();
		destroyable.own({
			destroy() {}
		});
		return destroyable.destroy().then(() => {
			assert.throws(() => {
				destroyable.own({
					destroy() {}
				});
			}, Error);
		});
	},
	'own handle destruction'() {
		let count = 0;
		const destroyable = createDestroyable();
		const handle = destroyable.own({
			destroy() {
				count++;
			}
		});
		assert.strictEqual(count, 0, 'destroy not called yet');
		handle.destroy();
		assert.strictEqual(count, 1, 'handle was destroyed');
		destroyable.destroy();
		assert.strictEqual(count, 1, 'destroy was not called again');
	},
	'isDestroyable()'() {
		const destroyable = createDestroyable();
		assert.isTrue(isDestroyable(destroyable));
		assert.isFalse(isDestroyable({}));
		assert.isFalse(isDestroyable(undefined));
		assert.isFalse(isDestroyable(/foo/));
		assert.isFalse(isDestroyable(() => { }));
	},
	'toString()'(this: any) {
		if (!hasToStringTag()) {
			this.skip('Environment doesn\'t support Symbol.toStringTag');
		}
		const destroyable = createDestroyable();
		assert.strictEqual((<any> destroyable).toString(), '[object Destroyable]');
	}
});
