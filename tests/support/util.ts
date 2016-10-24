let _hasConfigurableName: boolean;

/**
 * Detects if functions have configurable names, some browsers that are not 100% ES2015
 * compliant do not.
 */
export function hasConfigurableName(): boolean {
	if (_hasConfigurableName !== undefined) {
		return _hasConfigurableName;
	}
	const nameDescriptor = Object.getOwnPropertyDescriptor(function foo() {}, 'name');
	if (nameDescriptor && !nameDescriptor.configurable) {
		return _hasConfigurableName = false;
	}
	return _hasConfigurableName = true;
}

let _hasToStringTag: boolean;

/**
 * Detects if the runtime environment supports specifying a Symbol.toStringTag
 */
export function hasToStringTag(): boolean {
	if (_hasToStringTag !== undefined) {
		return _hasToStringTag;
	}
	const a: any = {};
	a[Symbol.toStringTag] = 'foo';
	return _hasToStringTag = (a + '') === '[object foo]';
}
