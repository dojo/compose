import { assign } from 'dojo-core/lang';
import { from as arrayFrom, includes } from 'dojo-shim/array';
import WeakMap from 'dojo-shim/WeakMap';
import {
	before as aspectBefore,
	after as aspectAfter,
	around as aspectAround,
	BeforeAdvice,
	AfterAdvice,
	AroundAdvice
} from './aspect';

/**
 * A weakmap that will store initialization functions for compose constructors
 */
const initFnMap = new WeakMap<Function, ComposeInitializationFunction<any, any>[]>();

/**
 * Reference to defineProperty to support minification
 */
const defineProperty = Object.defineProperty;

/**
 * A weakmap that will store static properties for compose factories
 */
const staticPropertyMap = new WeakMap<Function, {}>();

/**
 * Internal function which can label a function with a name
 */
function labelFunction(fn: Function, value: string): void {
	const nameDescriptor = Object.getOwnPropertyDescriptor(fn, 'name');
	if (typeof nameDescriptor === 'undefined' || nameDescriptor.configurable) {
		defineProperty(fn, 'name', {
			value,
			writable: true,
			configurable: true
		});
	}
}

/**
 * Internal function which can label a factory with a name and also provides a
 * function which
 *
 * @param fn The name of the factory to label
 * @param value The name to supply for the label
 */
function labelFactory(factory: Function, value: string): void {
	if (typeof factory === 'function' && factory.prototype) {
		labelFunction(factory, value);
		defineProperty(factory.prototype, 'toString', {
			value() {
				return `[object ${value}]`;
			},
			configurable: true
		});
	}
}

/**
 * For a given factory, return the names of the initialization functions that will be
 * invoked upon construction.
 *
 * @param factory The factory that the array of function names should be returned for
 */
export function getInitFunctionNames(factory: ComposeFactory<any, any>): string[] | undefined {
	const initFns = initFnMap.get(factory);
	if (initFns) {
		return initFns.map((fn) => (<any> fn).name);
	}
}

/**
 * A helper funtion to return a function that is rebased to infer that the
 * first argument of the passed function will be the `this` when the function
 * is executed.
 *
 * @param  fn The function to be rebased
 * @return    The rebased function
 */
function rebase(fn: (base: any, ...args: any[]) => any): (...args: any[]) => any {
	return function(this: any, ...args: any[]) {
		return fn.apply(this, [ this ].concat(args));
	};
}

/**
 * A helper function that copies own properties and their descriptors
 * from one or more sources to a target object. Includes non-enumerable properties
 *
 * @param target The target that properties should be copied onto
 * @param sources The rest of the parameters treated as sources to apply
 */
function copyProperties(target: any, ...sources: any[]) {
	sources.forEach((source) => {
		Object.defineProperties(
			target,
			Object.getOwnPropertyNames(source).reduce(
				(descriptors: PropertyDescriptorMap, key: string) => {
					if (key !== 'toString') { /* copying toString from a mixin causes issues */
						const sourceDescriptor = Object.getOwnPropertyDescriptor(source, key);
						const sourceValue = sourceDescriptor && sourceDescriptor.value;
						const targetDescriptor = Object.getOwnPropertyDescriptor(target, key);
						const targetValue = targetDescriptor && targetDescriptor.value;

						/* Special handling to merge array proprties */
						if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
							sourceDescriptor.value = sourceValue.reduce(
								(value: any[], current: any) => {
									if (!includes(target[key], current)) {
										value.push(current);
									}
									return value;
								},
								arrayFrom(targetValue)
							);
						}

						descriptors[key] = sourceDescriptor;
					}
					return descriptors;
				},
				Object.create(null)
			)
		);
	});
	return target;
}

/* The rebased functions we need to decorate compose constructors with */

/**
 * Perform an extension of a class
 */
const doExtend = rebase(extend);

/**
 * Perform a mixin of a class
 */
const doMixin = rebase(mixin);

/**
 * Perform an overlay of a class
 */
const doOverlay = rebase(overlay);

/**
 * Apply aspect advice to a class
 */
const doAspect = rebase(aspect);

/**
 * Add static method/properties to a class
 */
const doStatic = rebase(_static);

/**
 * Take a mixin and return a factory descriptor for the mixin
 *
 * @param mixin The factory to return the descriptor for
 * @template T The outer type of the descriptor
 * @template O The outer factory options of the descriptor
 * @template U The inner type of the descriptor
 * @template P The inner factory options of the descriptor
 */
function factoryDescriptor<T, O, U, P>(mixin: ComposeFactory<U, P>): ComposeMixinDescriptor<T, O, U, P> {
	return {
		mixin,
		className: mixin.name
	};
};

/**
 * Generate a factory descriptor for a class
 */
const doFactoryDescriptor = rebase(factoryDescriptor);

/**
 * A set of functions that are used to decorate the compose factories
 */
const stampFunctions = {
	extend: doExtend,
	mixin: doMixin,
	overlay: doOverlay,
	from: doFrom,
	before: doBefore,
	after: doAfter,
	around: doAround,
	aspect: doAspect,
	factoryDescriptor: doFactoryDescriptor,
	static: doStatic
};

/**
 * A convenience function to decorate compose class factories
 *
 * @param base The target constructor
 */
function stamp(base: any): void {
	assign(base, stampFunctions);
}

/**
 * Take a compose factory and clone it
 *
 * @param  base             The base to clone
 * @param  staticProperties Any static properties for the factory
 * @return                  The cloned constructor function
 */
function cloneFactory<T, O, S>(base: ComposeFactory<T, O>, staticProperties: S): ComposeFactory<T, O> & S;
function cloneFactory<T, O>(base: ComposeFactory<T, O>, name?: string): ComposeFactory<T, O>;
function cloneFactory<T, O>(name: string | undefined): ComposeFactory<T, O>;
function cloneFactory<T, O>(): ComposeFactory<T, O>;
function cloneFactory(base?: any, staticProperties?: any, name?: string): any {

	/**
	 * A compose factory
	 */
	function factory(this: ComposeFactory<any, any>, ...args: any[]): any {
		if (this && this.constructor === factory) {
			throw new SyntaxError('Factories cannot be called with "new".');
		}
		const instance = Object.create(factory.prototype);

		/* Clone any arrays in the instance */
		for (const key in instance) {
			if (Array.isArray(Object.getOwnPropertyDescriptor(factory.prototype, key).value)) {
				instance[key] = arrayFrom(instance[key]);
			}
		}

		args.unshift(instance);
		initFnMap.get(factory).forEach(fn => fn.apply(null, args));
		return instance;
	}

	if (typeof staticProperties === 'string') {
		name = staticProperties;
		staticProperties = undefined;
	}
	else if (typeof base === 'string') {
		name = base;
		base = undefined;
	}
	if (base) {
		copyProperties(factory.prototype, base.prototype);
		initFnMap.set(factory, arrayFrom(initFnMap.get(base)));
	}
	else {
		initFnMap.set(factory, []);
	}
	if (name) {
		labelFactory(factory, name);
	}
	factory.prototype.constructor = factory;
	stamp(factory);
	if (staticProperties) {
		if (isComposeFactory(staticProperties)) {
			staticProperties = staticPropertyMap.get(staticProperties) || {};
		}
		staticPropertyMap.set(factory, staticProperties);
		copyProperties(factory, staticProperties);
	}
	Object.freeze(factory);

	return factory;
}

/**
 * Takes any init functions from source and concats them to base and sets the map property for
 * the target
 *
 * @param target The compose factory to copy the init functions onto
 * @param source The ComposeFactory to copy the init functions from
 */
function concatInitFn<T, O, U, P>(target: ComposeFactory<T, O>, source: ComposeFactory<U, P>): void {
	const targetInitFns = initFnMap.get(target);

	/* initFn ordering is complicated, see dojo/compose#42 */

	/* Remove any duplicates from source */
	const sourceInitFns = initFnMap.get(source).filter((fn) => !includes(targetInitFns, fn));

	/* now append the unique source init functions onto the target init functions */
	initFnMap.set(target, [ ...targetInitFns, ...sourceInitFns ]);
}

/**
 * A custom type guard that determines if the value is a ComposeFactory
 *
 * @param   value The target to check
 * @returns       Return true if it is a ComposeFactory, otherwise false
 */
export function isComposeFactory(value: any): value is ComposeFactory<any, any> {
	return Boolean(value && initFnMap.get(value));
}

/* General Interfaces */

/**
 * Used to adapt any consructor functions or classes to a compose factory
 */
export interface GenericClass<T> {
	new (...args: any[]): T;
	readonly prototype: T;
}

/**
 * Used to adapt functions within compose
 */
export interface GenericFunction<T> {
	(...args: any[]): T;
}

export interface ComposeInitializationFunction<T, O> {
	/**
	 * A callback function use to initialize a new created instance
	 *
	 * @param instance The newly constructed instance
	 * @param options Any options that were passed to the factory
	 * @template T The type of the instance
	 * @template O The type of the options being passed
	 */
	(instance: T, options?: O): void;

	/**
	 * A string name of the function, used for debugging purposes
	 */
	readonly name?: string;
}

/* Extension API */
export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Extend the factory prototype with the supplied object literal, class, or factory
	 *
	 * @param extension The object literal, class or factory to extend
	 * @template T The original type of the factory
	 * @template U The type of the extension
	 * @template O The type of the factory options
	 * @template P The type of the extension factory options
	 */
	extend<U>(extension: U | GenericClass<U>): ComposeFactory<T & U, O>;
	extend<U>(className: string, extension: U | GenericClass<U>): ComposeFactory<T & U, O>;
	extend<U, P>(extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
	extend<U, P>(className: string, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
}

export interface Compose {
	/**
	 * Extend a compose factory prototype with the supplied object literal, class, or
	 * factory.
	 *
	 * @param base The base compose factory to extend
	 * @param extension The object literal, class or factory that is the extension
	 * @template T The base type of the factory
	 * @template U The type of the extension
	 * @template O The type of the base factory options
	 * @template P The type of the extension factory options
	 */
	extend<T, O, U>(base: ComposeFactory<T, O>, extension: U | GenericClass<U>): ComposeFactory<T & U, O>;
	extend<T, O, U>(base: ComposeFactory<T, O>, className: string, extension: U | GenericClass<U>): ComposeFactory<T & U, O>;
	extend<T, O, U, P>(base: ComposeFactory<T, O>, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
	extend<T, O, U, P>(base: ComposeFactory<T, O>, className: string, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
}

/**
 * The internal implementation of extending a compose factory
 *
 * @param base The base compose factory that is being extended
 * @param extension The extension to apply to the compose factory
 */
function extend<T, O, U, P>(base: ComposeFactory<T, O>, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
function extend<T, O, U, P>(base: ComposeFactory<T, O>, className: string, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
function extend<O>(base: ComposeFactory<any, O>, className: any, extension?: any): ComposeFactory<any, O> {
	if (typeof className !== 'string') {
		extension = className;
		className = undefined;
	}
	base = cloneFactory(base, className);
	copyProperties(base.prototype, typeof extension === 'function' ? extension.prototype : extension);
	return base;
}

/* Overlay API */

export interface OverlayFunction<T> {
	/**
	 * A function that takes a factories prototype, allowing it to change the prototype without
	 * mutating the type structure.
	 *
	 * @param proto The object literal that should be overlayed on the factories prototype.
	 * @template T The type of the factories prototype
	 */
	(proto: T): void;
}

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Provide a function that mutates the factories prototype but does not change the factory's class
	 * structure.
	 *
	 * @param overlayFunction The function which receives the factory's prototype
	 * @template T The type of the factory's prototype
	 */
	overlay(overlayFunction: OverlayFunction<T>): this;
}

export interface Compose {
	/**
	 * A static method that takes a compose factory and applies an overlay function to the factory,
	 * returning a new compose factory with a mutated prototype.
	 *
	 * @param base The base ComposeFactory
	 * @param overlayFunction The function which receives the base factory's prototype
	 * @template T The type of the factory's prototype
	 * @template O The options for the factory's creation
	 */
	overlay<T, O>(base: ComposeFactory<T, O>, overlayFunction: OverlayFunction<T>): ComposeFactory<T, O>;
}

/**
 * Internal implementation of the overlay functionality, to allow a function to modify a
 * compose factory prototype
 *
 * @param base The target compose factory
 * @param overlayFunction The callback function that will modify the prototype of the factory
 */
function overlay<T, O>(base: ComposeFactory<T, O>, overlayFunction: OverlayFunction<T>): ComposeFactory<T, O> {
	base = cloneFactory(base);
	overlayFunction(base.prototype);
	return base;
}

/* AOP/Inheritance API */

/**
 * A descriptor for applying advice to a set of methods
 */
export interface AspectAdvice {
	/**
	 * Any methods where the supplied advice should be applied *before* the base method is invoked
	 */
	before?: { [method: string]: BeforeAdvice };

	/**
	 * Any methods where the supplied advice should be applied *after* the base method is invoked
	 */
	after?: { [method: string]: AfterAdvice<any> };

	/**
	 * Any methods where the supplied advice should be applied *around* the base method
	 */
	around?: { [method: string]: AroundAdvice<any> };
}

/* Mixin API */

/**
 * Either a class, object literal, or a factory
 */
export type ComposeMixinItem<T, O> = GenericClass<T> | T | ComposeFactory<T, O>;

/**
 * An object which provides information on how to mixin into a compose factory
 */
export interface ComposeMixinDescriptor<T, O, U, P> {
	/**
	 * The class, object literal, or factory to be mixed in
	 */
	mixin?: ComposeMixinItem<U, P>;

	/**
	 * An initialize function to be executed upon construction
	 */
	initialize?: ComposeInitializationFunction<T & U, O & P>;

	/**
	 * Aspect Oriented Advice to be mixed into the factory
	 */
	aspectAdvice?: AspectAdvice;

	/**
	 * An optional class name which is used when labelling different parts of a factory for
	 * debugging purposes
	 */
	className?: string;
}

/**
 * Identifies a compose factory or other object that can be transformed into a
 * ComposeMixinDescriptor
 */
export interface ComposeMixinable<U, P> {
	/**
	 * A method that offers up a ComposeMixinDescriptor to allow complex mixin in of factories
	 */
	factoryDescriptor<T, O>(): ComposeMixinDescriptor<T, O, U, P>;
}

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Mixin additional mixins, initialization logic, and aspect advice into the factory
	 *
	 * @param mixin An object literal that describes what to mixin
	 */
	mixin<U, P>(mixin: ComposeMixinable<U, P>):
		ComposeFactory<T & U, O & P>;
	mixin<U, P>(mixin: ComposeMixinDescriptor<T, O, U, P>):
		ComposeFactory<T & U, O & P>;
}

export interface Compose {
	/**
	 * Mixin additional mixins, initialization logic, and aspect advice into a factory
	 *
	 * @param base The base factory that is the target of the mixin
	 * @param mixin An object literal that describes what to mixin
	 */
	mixin<T, O, U, P>(
		base: ComposeFactory<T, O>,
		mixin: ComposeMixinable<U, P>
	): ComposeFactory<T & U, O & P>;
	mixin<T, O, U, P>(
		base: ComposeFactory<T, O>,
		mixin: ComposeMixinDescriptor<T, O, U, P>
	): ComposeFactory<T & U, O & P>;
}

/**
 * A custom type guard that determines if a value is ComposeMixinable
 *
 * @param value The value to guard for
 */
function isComposeMixinable(value: any): value is ComposeMixinable<any, any> {
	return Boolean(value && 'factoryDescriptor' in value && typeof value.factoryDescriptor === 'function');
}

/**
 * The internal implementation of mixin in values into a compose factory
 *
 * @param base The base compose factory that is the target for being mixed in
 * @param toMixin The value to be mixed in
 */
function mixin<T, O, U, P>(
	base: ComposeFactory<T, O>,
	toMixin: ComposeMixinable<U, P> | ComposeMixinDescriptor<T, O, U, P>
): ComposeFactory<T & U, O & P> {
	const mixin = isComposeMixinable(toMixin) ? toMixin.factoryDescriptor() : toMixin;
	const mixinType =  mixin.mixin;
	base = cloneFactory(base, mixin.className || base.name);
	if (mixinType) {
		const mixinFactory = isComposeFactory(mixinType) ? mixinType : create(mixinType);
		concatInitFn(base, mixinFactory);
		const baseInitFns = initFnMap.get(base);
		if (mixin.initialize) {
			if (!includes(baseInitFns, mixin.initialize)) {
				labelFunction(
					mixin.initialize,
					`mixin${mixin.className || (isComposeFactory(mixin.mixin) && mixin.mixin.name) || base.name || 'Anonymous'}`
				);
				baseInitFns.push(mixin.initialize);
			}
		}
		copyProperties(base.prototype, mixinFactory.prototype);
	}
	else if (mixin.initialize) {
		/* TODO: We should be able to combine with the logic above */
		const baseInitFns = initFnMap.get(base);
		if (!includes(baseInitFns, mixin.initialize)) {
			labelFunction(
				mixin.initialize,
				`mixin${mixin.className || base.name || 'Anonymous'}`
			);
			baseInitFns.push(mixin.initialize);
		}
	}
	if (mixin.aspectAdvice) {
		base = aspect(base, mixin.aspectAdvice);
	}
	return base as ComposeFactory<T & U, O & P>;
}

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Extract a method from another Class or Factory and add it to the returned factory
	 *
	 * @param base The base Class or Factory
	 * @param method The name of the method to extract
	 */
	from(base: GenericClass<any> | ComposeFactory<any, any>, method: string): this;

	/**
	 * Apply advice *before* the named method (join-point)
	 *
	 * @param method The method to apply the advice to
	 * @param advice The advice to be applied
	 */
	before(method: string, advice: BeforeAdvice): this;

	/**
	 * Apply advice *after* the named method (join-point)
	 *
	 * @param method The method to apply the advice to
	 * @param advice The advice to be applied
	 */
	after<P>(method: string, advice: AfterAdvice<P>): this;

	/**
	 * Apply advice *around* the named method (join-point)
	 *
	 * @param method The method to apply the advice to
	 * @param advice The advice to be applied
	 */
	around<P>(method: string, advice: AroundAdvice<P>): this;

	/**
	 * Provide an object literal which can contain a map of advice to apply
	 *
	 * @param advice An object literal which contains the maps of advice to apply
	 */
	aspect(advice: AspectAdvice): this;
}

export interface Compose {
	/**
	 * Extract a method from another Class or Factory and return it
	 *
	 * @param base The Class or Factory to extract from
	 * @param method The method name to be extracted
	 */
	from<T extends Function>(base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol): T;

	/**
	 * Apply advice *before* the named method (join-point)
	 *
	 * @param base The Class or Factory to extract the method from
	 * @param method The method name to apply the advice to
	 * @param advice The advice to apply
	 */
	before<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol, advice: BeforeAdvice): GenericFunction<T>;
	before<T>(method: GenericFunction<T>, advice: BeforeAdvice): GenericFunction<T>;

	/**
	 * Apply advice *after* the named method (join-point)
	 *
	 * @param base The Class or Factory to extract the method from
	 * @param method The method name to apply the advice to
	 * @param advice The advice to apply
	 */
	after<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol, advice: AfterAdvice<T>): GenericFunction<T>;
	after<T>(method: GenericFunction<T>, advice: AfterAdvice<T>): GenericFunction<T>;

	/**
	 * Apply advice *around* the named method (join-point)
	 *
	 * @param base The Class or Factory to extract the method from
	 * @param method The method name to apply the advice to
	 * @param advice The advice to apply
	 */
	around<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol, advice: AroundAdvice<T>): GenericFunction<T>;
	around<T>(method: GenericFunction<T>, advice: AroundAdvice<T>): GenericFunction<T>;

	/**
	 * Apply advice to methods that exist in the base factory using the supplied advice map
	 *
	 * @param base The Factory that contains the methods the advice will be applied to
	 * @param advice The map of advice to be applied
	 */
	aspect<O, A>(base: ComposeFactory<O, A>, advice: AspectAdvice): ComposeFactory<O, A>;
}

/**
 * Internal implementation of extracting methods from another object
 *
 * @param base The target that the method should be extracted from
 * @param method The name of the method
 */
function from<T extends Function>(base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol): T {
	return base.prototype[method];
}

/**
 * Internal implementation to apply from when `this` represents the base
 *
 * @param base The target that the method should be extracted from
 * @param method The name of the method
 */
function doFrom<T, O>(this: ComposeFactory<T, O>, base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol): ComposeFactory<T, O> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = base.prototype[method];
	return clone as ComposeFactory<T, O>;
}

/**
 * The internal implementation to apply before advice to a factory
 *
 * @param base The target that the advice should be applied to
 * @param method The name of the method that the advice should be applied to
 * @param advice The advice to apply
 */
function before<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol, advice: BeforeAdvice): GenericFunction<T>;
function before<T>(method: GenericFunction<T>, advice: BeforeAdvice): GenericFunction<T>;
function before(...args: any[]): GenericFunction<any> {
	let base: GenericFunction<any>;
	let method: string | GenericFunction<any>;
	let advice: BeforeAdvice;
	if (args.length >= 3) {
		[ base, method, advice ] = args;
		method = base.prototype[<string> method];
	}
	else {
		[ method, advice ] = args;
	}
	return aspectBefore(<GenericFunction<any>> method, advice);
}

/**
 * The internal implementation to apply before advice when `this` is scoped as the base factory
 *
 * @param method The name of the method that the advice should be applied to
 * @param advice The advice to apply
 */
function doBefore<T, O>(this: ComposeFactory<T, O>, method: string | symbol, advice: BeforeAdvice): ComposeFactory<T, O> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectBefore((<any> clone.prototype)[method], advice);
	return <ComposeFactory<T, O>> clone;
}

/**
 * The internal implementation to apply after advice to a factory
 *
 * @param base The target that the advice should be applied to
 * @param method The name of the method that the advice should be applied to
 * @param advice The advice to apply
 */
function after<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol, advice: AfterAdvice<T>): GenericFunction<T>;
function after<T>(method: GenericFunction<T>, advice: AfterAdvice<T>): GenericFunction<T>;
function after(...args: any[]): GenericFunction<any> {
	let base: GenericFunction<any>;
	let method: string | GenericFunction<any>;
	let advice: AfterAdvice<any>;
	if (args.length >= 3) {
		[ base, method, advice ] = args;
		method = base.prototype[<string> method];
	}
	else {
		[ method, advice ] = args;
	}
	return aspectAfter(<GenericFunction<any>> method, advice);
}

/**
 * The internal implementation to apply after advice when `this` is scoped as the base factory
 *
 * @param method The name of the method that the advice should be applied to
 * @param advice The advice to apply
 */
function doAfter<T, P, O>(this: ComposeFactory<T, O>, method: string | symbol, advice: AfterAdvice<P>): ComposeFactory<T, O> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectAfter((<any> clone.prototype)[method], advice);
	return <ComposeFactory <T, O>> clone;
}

/**
 * The internal implementation to apply after around when `this` is scoped as the base factory
 *
 * @param method The name of the method that the advice should be applied to
 * @param advice The advice to apply
 */
function around<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string | symbol, advice: AfterAdvice<T>): GenericFunction<T>;
function around<T>(method: GenericFunction<T>, advice: AroundAdvice<T>): GenericFunction<T>;
function around(...args: any[]): GenericFunction<any> {
	let base: GenericFunction<any>;
	let method: string | GenericFunction<any>;
	let advice: AfterAdvice<any>;
	if (args.length >= 3) {
		[ base, method, advice ] = args;
		method = base.prototype[<string> method];
	}
	else {
		[ method, advice ] = args;
	}
	return aspectAround(<GenericFunction<any>> method, advice);
}

/**
 * The internal implementation to apply around advice when `this` is scoped as the base factory
 *
 * @param method The name of the method that the advice should be applied to
 * @param advice The advice to apply
 */
function doAround<T, P, O>(this: ComposeFactory<T, O>, method: string | symbol, advice: AroundAdvice<P>): ComposeFactory<T, O> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectAround((<any> clone.prototype)[method], advice);
	return <ComposeFactory <T, O>> clone;
}

function aspect<T, O>(base: ComposeFactory<T, O>, advice: AspectAdvice): ComposeFactory<T, O> {
	const clone = cloneFactory(base);

	function mapAdvice(adviceHash: { [ method: string ]: Function }, advisor: Function): void {
		for (let key in adviceHash) {
			if (key in clone.prototype) {
				(<any> clone.prototype)[key] = advisor((<any> clone.prototype)[key], adviceHash[key]);
			}
			else {
				throw new Error('Trying to advise non-existing method: "' + key + '"');
			}
		}
	}

	if (advice.before) {
		mapAdvice(advice.before, before);
	}
	if (advice.after) {
		mapAdvice(advice.after, after);
	}
	if (advice.around) {
		mapAdvice(advice.around, around);
	}
	return clone;
}

/* Creation API */

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Create a new instance
	 *
	 * @param options Options that are passed to the initialization functions of the factory
	 */
	(options?: O): T;

	/**
	 * The read only prototype of the factory
	 */
	readonly prototype: T;
}

export interface Compose {
	/**
	 * Create a new factory based on a supplied Class, Factory or Object prototype with an optional
	 * initalization function
	 *
	 * @param base The base Class, Factory or Object prototype to use
	 * @param initFunction An optional function that will be passed the instance and any creation options
	 * @param className An optional class name that is used to label the factory for debug purposes
	 */
	<T, O>(base: GenericClass<T> | T): ComposeFactory<T, O>;
	<T, O>(className: string, base: GenericClass<T> | T): ComposeFactory<T, O>;
	<T, O>(base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	<T, O>(className: string, base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;
	<T, O, P>(className: string, base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;

	/**
	 * Create a new factory based on a supplied Class, Factory or Object prototype with an optional
	 * initialization function
	 *
	 * @param base The base Class, Facotry or Object prototype to use
	 * @param initFunction An optional function that will be passed the instance and nay creation options
	 */
	create<T, O>(base: GenericClass<T> | T): ComposeFactory<T, O>;
	create<T, O>(className: string, base: GenericClass<T> | T): ComposeFactory<T, O>;
	create<T, O>(base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	create<T, O>(className: string, base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	create<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;
	create<T, O, P>(className: string, base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;
}

/**
 * The internal implementation to create a compose factory
 *
 * @param base The base to use for creating the factory
 * @param initFunction Any function that should be run after the factory creates the instance
 */
function create<T, O>(base: GenericClass<T> | T): ComposeFactory<T, O>;
function create<T, O>(className: string, base: GenericClass<T> | T): ComposeFactory<T, O>;
function create<T, O>(base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
function create<T, O>(className: string, base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
function create<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;
function create<T, O, P>(className: string, base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;
function create<O>(className: any, base?: any, initFunction?: ComposeInitializationFunction<any, O>): ComposeFactory<any, any> {
	if (typeof className !== 'string') {
		initFunction = base;
		base = className;
		className = undefined;
	}
	const factory = cloneFactory(className);
	if (initFunction) {
		if (className) {
			labelFunction(initFunction, `init${className}`);
		}
		initFnMap.get(factory).push(initFunction);
	}

	/* mixin the base into the prototype */
	copyProperties(factory.prototype, typeof base === 'function' ? base.prototype : base);

	/* return the new constructor */
	return factory;
	}

/* Extend factory with static properties */

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Add static properties to a factory
	 *
	 * @param staticProperties An object literal that contains methods and properties that should be "static" (e.g. added to
	 *                         the factory, instead of the factory's prototype)
	 */
	static<S>(staticProperties: S): this & S;
}

export interface Compose {
	/**
	 * Add static properties to a factory
	 *
	 * @param staticProperties An object literal that contains methods and properties that should be "static" (e.g. added to
	 *                         the factory, instead of the factory's prototype)
	 */
	static<F extends ComposeFactory<T, O>, T, O, S>(factory: F, staticProperties: S): F & S;
}

/**
 * Internal implementation of applying static properties to a compose factory
 *
 * @param factory The factory that the static properties should be applied to
 * @param staticProperties The properties to be applied to the factory
 */
function _static<F extends ComposeFactory<T, O>, T, O, S>(base: F, staticProperties: S): F & S {
	return <F & S> cloneFactory(base, staticProperties);
}

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * The class name of the ComposeFactory
	 */
	readonly name?: string;
}

/**
 * A factory construction utility
 *
 * @param base An ES6 Class, ComposeFactory or Object literal to use as the base for the new factory
 * @param initFunction An optional initialization function for the factory
 */
const compose = create as Compose;

/* Add static methods to compose */

assign(compose, {
	create,
	static: _static,
	extend,
	mixin,
	overlay,
	from,
	before,
	after,
	around,
	aspect
});

export default compose;
