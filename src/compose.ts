import WeakMap from 'dojo-core/WeakMap';
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
 * A weakmap that will store static properties for compose factories
 */
const staticPropertyMap = new WeakMap<Function, {}>();

/**
 * A helper funtion to return a function that is rebased to infer that the
 * first argument of the passed function will be the `this` when the function
 * is executed.
 *
 * @param  fn The function to be rebased
 * @return    The rebased function
 */
function rebase(fn: (base: any, ...args: any[]) => any): (...args: any[]) => any {
	return function(...args: any[]) {
		return fn.apply(this, [ this ].concat(args));
	};
}

/**
 * A helper function that copies own properties and their descriptors
 * from one or more sources to a target object. Includes non-enumerable properties
 */
function copyProperties(target: {}, ...sources: {}[]) {
	sources.forEach(source => {
		Object.defineProperties(
			target,
			Object.getOwnPropertyNames(source).reduce(
				(descriptors: { [ index: string ]: any }, key: string) => {
					descriptors[ key ] = Object.getOwnPropertyDescriptor(source, key);
					return descriptors;
				},
				{}
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
		mixin: mixin
	};
};

/**
 * Generate a factory descriptor for a class
 */
const doFactoryDescriptor = rebase(factoryDescriptor);

/**
 * A convenience function to decorate compose class constructors
 * @param base The target constructor
 */
function stamp(base: any): void {
	base.extend = doExtend;
	base.mixin = doMixin;
	base.overlay = doOverlay;
	base.from = doFrom;
	base.before = doBefore;
	base.after = doAfter;
	base.around = doAround;
	base.aspect = doAspect;
	base.factoryDescriptor = doFactoryDescriptor;
	base.static = doStatic;
}

/**
 * Take a compose factory and clone it
 *
 * @param  base             The base to clone
 * @param  staticProperties Any static properties for the factory
 * @return                  The cloned constructor function
 */
function cloneFactory<T, O, S>(base: ComposeFactory<T, O>, staticProperties: S): ComposeFactory<T, O> & S;
function cloneFactory<T, O>(base: ComposeFactory<T, O>): ComposeFactory<T, O>;
function cloneFactory<T, O>(): ComposeFactory<T, O>;
function cloneFactory(base?: any, staticProperties?: any): any {

	function factory(...args: any[]): any {
		if (this && this.constructor === factory) {
			throw new SyntaxError('Factories cannot be called with "new".');
		}
		const instance = Object.create(factory.prototype);
		args.unshift(instance);
		initFnMap.get(factory).forEach(fn => fn.apply(null, args));
		return instance;
	}

	if (base) {
		copyProperties(factory.prototype, base.prototype);
		initFnMap.set(factory, [].concat(initFnMap.get(base)));
	}
	else {
		initFnMap.set(factory, []);
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
 * Takes any init functions from source and concats them to base
 * @param target The compose factory to copy the init functions onto
 * @param source The ComposeFactory to copy the init functions from
 */
function concatInitFn<T, O, U, P>(target: ComposeFactory<T, O>, source: ComposeFactory<U, P>): void {
	const sourceInitFns = initFnMap.get(source);

	/* making sure only unique functions get added */
	const targetInitFns = initFnMap.get(target).filter((fn) => {
		return sourceInitFns.indexOf(fn) < 0;
	});

	/* now prepend the source init functions to the unique init functions for the target */
	initFnMap.set(target, sourceInitFns.concat(targetInitFns));
}

/**
 * A custom type guard that determines if the value is a ComposeFactory
 * @param   value The target to check
 * @returns       Return true if it is a ComposeFactory, otherwise false
 */
export function isComposeFactory(value: any): value is ComposeFactory<any, any> {
	return Boolean(initFnMap.get(value));
}

/* General Interfaces */

/**
 * Used to adapt any consructor functions or classes to a compose factory
 */
export interface GenericClass<T> {
	new (...args: any[]): T;
	prototype: T;
}

export interface ComposeInitializationFunction<T, O> {
	/**
	 * A callback function use to initialize a new created instance
	 * @param instance The newly constructed instance
	 * @param options Any options that were passed to the factory
	 * @template T The type of the instance
	 * @template O The type of the options being passed
	 */
	(instance: T, options?: O): void;
}

/* Extension API */
export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Extend the factory prototype with the supplied object literal, class, or factory
	 * @param extension The object literal, class or factory to extend
	 * @template T The original type of the factory
	 * @template U The type of the extension
	 * @template O The type of the factory options
	 * @template P The type of the extension factory options
	 */
	extend<U>(extension: U | GenericClass<U>): ComposeFactory<T & U, O>;
	extend<U, P>(extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
}

export interface Compose {
	/**
	 * Extend a compose factory prototype with the supplied object literal, class, or
	 * factory.
	 * @param base The base compose factory to extend
	 * @param extension The object literal, class or factory that is the extension
	 * @template T The base type of the factory
	 * @template U The type of the extension
	 * @template O The type of the base factory options
	 * @template P The type of the extension factory options
	 */
	extend<T, O, U>(base: ComposeFactory<T, O>, extension: U | GenericClass<U>): ComposeFactory<T & U, O>;
	extend<T, O, U, P>(base: ComposeFactory<T, O>, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
}

function extend<T, O, U, P>(base: ComposeFactory<T, O>, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
function extend<O>(base: ComposeFactory<any, O>, extension: any): ComposeFactory<any, O> {
	base = cloneFactory(base);
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

function overlay<T, O>(base: ComposeFactory<T, O>, overlayFunction: OverlayFunction<T>): ComposeFactory<T, O> {
	base = cloneFactory(base);
	overlayFunction(base.prototype);
	return base;
}

/* AOP/Inheritance API */

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
}

/**
 * Identifies a compose factory or other object that can be
 * transformed into a ComposeMixinDescriptor
 */
export interface ComposeMixinable<U, P> {
	/**
	 * A method that offers up a ComposeMixinDescriptor to allow complex mixin in of factories
	 */
	factoryDescriptor<T, O>(): ComposeMixinDescriptor<T, O, U, P>;
}

// export type descriptorFactory

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Mixin additional mixins, initialization logic, and aspect advice into the factory
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

function isComposeMixinable(value: any): value is ComposeMixinable<any, any> {
	return Boolean(value && 'factoryDescriptor' in value && typeof value.factoryDescriptor === 'function');
}

function mixin<T, O, U, P>(
	base: ComposeFactory<T, O>,
	toMixin: ComposeMixinable<U, P> | ComposeMixinDescriptor<T, O, U, P>
): ComposeFactory<T & U, O & P> {
	base = cloneFactory(base);
	const baseInitFns = initFnMap.get(base);
	const mixin = isComposeMixinable(toMixin) ? toMixin.factoryDescriptor() : toMixin;
	const mixinType =  mixin.mixin;
	if (mixinType) {
		let mixinFactory = isComposeFactory(mixinType) ? mixinType : create(mixinType);
		if (mixin.initialize) {
			if (baseInitFns.indexOf(mixin.initialize) < 0) {
				baseInitFns.unshift(mixin.initialize);
			}
		}
		concatInitFn(base, mixinFactory);
		copyProperties(base.prototype, mixinFactory.prototype);
	}
	else if (mixin.initialize) {
		if (baseInitFns.indexOf(mixin.initialize) < 0) {
			baseInitFns.unshift(mixin.initialize);
		}
	}
	if (mixin.aspectAdvice) {
		base = aspect(base, mixin.aspectAdvice);
	}
	return base as ComposeFactory<T & U, O & P>;
}

export interface GenericFunction<T> {
	(...args: any[]): T;
}

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Extract a method from another Class or Factory and add it to the returned factory
	 * @param base The base Class or Factory
	 * @param method The name of the method to extract
	 */
	from(base: GenericClass<any> | ComposeFactory<any, any>, method: string): this;

	/**
	 * Apply advice *before* the named method (join-point)
	 * @param method The method to apply the advice to
	 * @param advice The advice to be applied
	 */
	before(method: string, advice: BeforeAdvice): this;

	/**
	 * Apply advice *after* the named method (join-point)
	 * @param method The method to apply the advice to
	 * @param advice The advice to be applied
	 */
	after<P>(method: string, advice: AfterAdvice<P>): this;

	/**
	 * Apply advice *around* the named method (join-point)
	 * @param method The method to apply the advice to
	 * @param advice The advice to be applied
	 */
	around<P>(method: string, advice: AroundAdvice<P>): this;

	/**
	 * Provide an object literal which can contain a map of advice to apply
	 * @param advice An object literal which contains the maps of advice to apply
	 */
	aspect(advice: AspectAdvice): this;
}

export interface Compose {
	/**
	 * Extract a method from another Class or Factory and return it
	 * @param base The Class or Factory to extract from
	 * @param method The method name to be extracted
	 */
	from<T extends Function>(base: GenericClass<any> | ComposeFactory<any, any>, method: string): T;

	/**
	 * Apply advice *before* the named method (join-point)
	 * @param base The Class or Factory to extract the method from
	 * @param method The method name to apply the advice to
	 * @param advice The advice to apply
	 */
	before<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
	before<T>(method: GenericFunction<T>, advice: BeforeAdvice): GenericFunction<T>;

	/**
	 * Apply advice *after* the named method (join-point)
	 * @param base The Class or Factory to extract the method from
	 * @param method The method name to apply the advice to
	 * @param advice The advice to apply
	 */
	after<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
	after<T>(method: GenericFunction<T>, advice: AfterAdvice<T>): GenericFunction<T>;

	/**
	 * Apply advice *around* the named method (join-point)
	 * @param base The Class or Factory to extract the method from
	 * @param method The method name to apply the advice to
	 * @param advice The advice to apply
	 */
	around<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string, advice: AroundAdvice<T>): GenericFunction<T>;
	around<T>(method: GenericFunction<T>, advice: AroundAdvice<T>): GenericFunction<T>;

	/**
	 * Apply advice to methods that exist in the base factory using the supplied advice map
	 * @param base The Factory that contains the methods the advice will be applied to
	 * @param advice The map of advice to be applied
	 */
	aspect<O, A>(base: ComposeFactory<O, A>, advice: AspectAdvice): ComposeFactory<O, A>;
}

function from<T extends Function>(base: GenericClass<any> | ComposeFactory<any, any>, method: string): T {
	return base.prototype[method];
}

function doFrom<T, O>(base: GenericClass<any> | ComposeFactory<any, any>, method: string): ComposeFactory<T, O> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = base.prototype[method];
	return clone as ComposeFactory<T, O>;
}

function before<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
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

function doBefore<T, O>(method: string, advice: BeforeAdvice): ComposeFactory<T, O> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectBefore((<any> clone.prototype)[method], advice);
	return <ComposeFactory<T, O>> clone;
}

function after<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
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

function doAfter<T, P, O>(method: string, advice: AfterAdvice<P>): ComposeFactory<T, O> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectAfter((<any> clone.prototype)[method], advice);
	return <ComposeFactory <T, O>> clone;
}

function around<T>(base: GenericClass<any> | ComposeFactory<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
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

function doAround<T, P, O>(method: string, advice: AroundAdvice<P>): ComposeFactory<T, O> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectAround((<any> clone.prototype)[method], advice);
	return <ComposeFactory <T, O>> clone;
}

function aspect<T, O>(base: ComposeFactory<T, O>, advice: AspectAdvice): ComposeFactory<T, O> {
	const clone = cloneFactory(base);

	function mapAdvice(adviceHash: { [method: string ]: Function }, advisor: Function): void {
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
	 * @param options Options that are passed to the initialization functions of the factory
	 */
	(options?: O): T;

	/**
	 * The read only prototype of the factory
	 */
	prototype: T;
}

export interface Compose {
	/**
	 * Create a new factory based on a supplied Class, Factory or Object prototype with an optional
	 * initalization function
	 * @param base The base Class, Factory or Object prototype to use
	 * @param initFunction An optional function that will be passed the instance and any creation options
	 */
	<T, O>(base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;

	/**
	 * Create a new factory based on a supplied Class, Factory or Object prototype with an optional
	 * initialization function
	 * @param base The base Class, Facotry or Object prototype to use
	 * @param initFunction An optional function that will be passed the instance and nay creation options
	 */
	create<T, O>(base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	create<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;
}

function create<T, O>(base: GenericClass<T> | T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
function create<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, O & P>): ComposeFactory<T, O & P>;
function create<O>(base: any, initFunction?: ComposeInitializationFunction<any, O>): any {
	const factory = cloneFactory();
	if (initFunction) {
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
	 * @param staticProperties An object literal that contains methods and properties that should be "static" (e.g. added to
	 *                         the factory, instead of the factory's prototype)
	 */
	static<S>(staticProperties: S): this & S;
}

export interface Compose {
	/**
	 * Add static properties to a factory
	 * @param staticProperties An object literal that contains methods and properties that should be "static" (e.g. added to
	 *                         the factory, instead of the factory's prototype)
	 */
	static<F extends ComposeFactory<T, O>, T, O, S>(factory: F, staticProperties: S): F & S;
}

function _static<F extends ComposeFactory<T, O>, T, O, S>(factory: F, staticProperties: S): F & S {
	return <F & S> cloneFactory(factory, staticProperties);
}

/**
 * A factory construction utility
 * @param base An ES6 Class, ComposeFactory or Object literal to use as the base for the new factory
 * @param initFunction An optional initialization function for the factory
 */
const compose = create as Compose;

/* Add static methods to compose */
compose.create = create;
compose.static = _static;
compose.extend = extend;
compose.mixin = mixin;
compose.overlay = overlay;
compose.from = from;
compose.before = before;
compose.after = after;
compose.around = around;
compose.aspect = aspect;

export default compose;
