import { deprecated } from 'dojo-core/instrument';
import { assign } from 'dojo-core/lang';
import { from as arrayFrom, includes } from 'dojo-shim/array';
import WeakMap from 'dojo-shim/WeakMap';
import Symbol from 'dojo-shim/Symbol';
import {
	before as aspectBefore,
	after as aspectAfter,
	around as aspectAround,
	BeforeAdvice,
	AfterAdvice,
	AroundAdvice
} from './aspect';

/**
 * A tuple of advice types and advice
 */
type AdviceTuple = ['before', BeforeAdvice] | ['after', AfterAdvice<any>] | ['around', AroundAdvice<any>];

/**
 * A map of advice to apply to a method, with the `method` key being a tuple of advice
 */
type AdviceMap = {
	[method: string]: AdviceTuple[];
};

/**
 * Interface for storing the private meta data related to a factory
 */
interface PrivateFactoryData {
	/**
	 * A map of advice that should be applied to a prototype of a factory as it is being constructed
	 */
	advice?: AdviceMap;

	/**
	 * The base prototype that contains the methods and properties without advice applied
	 */
	base?: any;

	/**
	 * The array of initialization functions that should be applied to the instance upon creation
	 */
	initFns: ComposeInitializationFunction<any, any>[];

	/**
	 * Any static properties/methods that should be applied when creating a factory
	 */
	staticProperties?: any;
}

/**
 * The default factory label if no label can be derived during the factory creation process
 */
const DEFAULT_FACTORY_LABEL = 'Compose';

/* References to support minification */
const defineProperty = Object.defineProperty;
const isArray = Array.isArray;
const objectCreate = Object.create;
const objectKeys = Object.keys;

/**
 * A weakmap that stores all the private data for a factory
 */
const privateFactoryData = new WeakMap<Function, PrivateFactoryData>();

/**
 * An internal function which stubs out a method which, when called at runtime, throws.
 *
 * @param method The name of "abstract" method being called
 */
function missingMethod(method: string): () => never {
	return function throwOnMissingMethod(): never {
		throw new TypeError(`Advice being applied to missing method named: ${method}`);
	};
}

/**
 * Internal function which can label a factory with a name and also sets
 * the `toString()` method on the prototype to return the approriate
 * name for instances.
 *
 * @param fn The name of the factory to label
 * @param value The name to supply for the label
 */
function assignFactoryName(factory: Function, value: string): void {
	if (typeof factory === 'function' && factory.prototype) {
		assignFunctionName(factory, value);
		defineProperty(factory.prototype, <any> Symbol.toStringTag, {
			get() {
				return value;
			},
			configurable: true
		});
	}
}

/**
 * Internal function which can label a function with a name
 */
function assignFunctionName(fn: Function, value: string): void {
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
 * A helper function that copies own properties and their descriptors
 * from one or more sources to a target object. Includes non-enumerable properties
 *
 * @param target The target that properties should be copied onto
 * @param sources The rest of the parameters treated as sources to apply
 */
function assignProperties(target: any, ...sources: any[]) {
	sources.forEach((source) => {
		if (!source) {
			return;
		}
		Object.defineProperties(
			target,
			Object.getOwnPropertyNames(source).reduce(
				(descriptors: PropertyDescriptorMap, key: string) => {
					if (key !== 'constructor') { /* don't copy constructor */
						const sourceDescriptor = Object.getOwnPropertyDescriptor(source, key);
						const sourceValue = sourceDescriptor && sourceDescriptor.value;
						const targetDescriptor = Object.getOwnPropertyDescriptor(target, key);
						const targetValue = targetDescriptor && targetDescriptor.value;

						/* Special handling to merge array proprties */
						if (isArray(sourceValue) && isArray(targetValue)) {
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
				objectCreate(null)
			)
		);
	});
	return target;
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
 * For a given factory, return the names of the initialization functions that will be
 * invoked upon construction.
 *
 * @param factory The factory that the array of function names should be returned for
 */
export function getInitFunctionNames(factory: ComposeFactory<any, any>): string[] | undefined {
	const initFns = privateFactoryData.get(factory).initFns;
	if (initFns) {
		return initFns.map((fn) => (<any> fn).name);
	}
}

/* The rebased functions we need to decorate compose constructors with */

/**
 * Perform an extension of a class
 *
 * @deprecated
 */
const doExtend = rebase(extend);

/**
 * Perform a mixin of a class
 */
const doMixin = rebase(mixin);

/**
 * Perform a override of a class
 */
const doOverride = rebase(override);

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
const staticMethods = {
	extend: doExtend, /* DEPRECATED */
	mixin: doMixin,
	override: doOverride,
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
 * A convenience function to decorate compose class factories, including any static prpoerties
 *
 * @param base The target constructor
 */
interface FactoryOptions<T, U, O, S> {
	advice?: AdviceMap;
	factories?: ComposeFactory<U, O>[];
	initFunction?: ComposeInitializationFunction<any, O>;
	className?: string;
	proto?: T;
	staticProperties?: S;
}

/**
 * Internal function that merges (or creates) an advice map
 *
 * @param sources The advice maps to be merged into a single one
 */
function assignAdviceMap(...sources: (AdviceMap | undefined)[]): AdviceMap {
	const result: AdviceMap = {};
	sources.forEach((source) => {
		if (source) {
			for (const method in source) {
				result[method] = result[method] ? [ ...result[method], ...source[method] ] : [ ...source[method] ];
			}
		}
	});
	return result;
}

/**
 * An internal function that takes a set of create widget options and returns a set of private factory data
 *
 * @param options The set of factory options to use in creating the private factory data
 */
function createPrivateFactoryData({
	advice: optionsAdvice,
	factories,
	initFunction,
	proto,
	staticProperties
}: FactoryOptions<any, any, any, any>): PrivateFactoryData {
	const factoryData = (factories || []).reduce((factoryData, factory) => {
		const { advice, base, initFns } = privateFactoryData.get(factory);
		if (advice) {
			factoryData.advice = assignAdviceMap(factoryData.advice, advice);
		}
		if (base) {
			assignProperties(factoryData.base, base);
		}
		const optionsInitFns = factoryData.initFns;
		initFns.forEach((initFn) => {
			if (!includes(optionsInitFns, initFn)) {
				optionsInitFns.push(initFn);
			}
		});
		return factoryData;
	}, {
		base: {},
		initFns: [],
		staticProperties: staticProperties ? assign({}, staticProperties) : undefined
	} as PrivateFactoryData);

	if (initFunction) {
		factoryData.initFns.push(initFunction);
	}

	if (optionsAdvice) {
		factoryData.advice = assignAdviceMap(factoryData.advice, optionsAdvice);
	}

	assignProperties(factoryData.base, proto);

	return factoryData;
}

function createFactory<T, U, O, S>(options: FactoryOptions<T, U, O, S>): ComposeFactory<T & U, O> & S;
function createFactory<T, U, O>(options: FactoryOptions<T, U, O, any>): ComposeFactory<T & U, O> & any {

	/**
	 * A compose factory
	 */
	function factory(this: ComposeFactory<any, any>, ...args: any[]): any {
		if (this && this.constructor === factory) {
			throw new SyntaxError('Factories cannot be called with "new".');
		}
		const instance = objectCreate(factory.prototype);

		/* clone any arrays in the instance */
		for (const key in instance) {
			if (isArray(Object.getOwnPropertyDescriptor(factory.prototype, key).value)) {
				instance[key] = arrayFrom(instance[key]);
			}
		}

		args.unshift(instance);
		privateFactoryData.get(factory).initFns.forEach(fn => {
			fn.apply(null, args);
		});
		return instance;
	}

	const factoryData = createPrivateFactoryData(options);

	privateFactoryData.set(factory, factoryData);

	const factoryPrototype = factory.prototype;

	/* mixin base properties into the prototype */
	assignProperties(factoryPrototype, factoryData.base);

	/* apply any advice to the prototype */
	if (factoryData.advice) {
		for (const method in factoryData.advice) {
			factoryData.advice[method].forEach(([ aspect, advice ]) => {
				const sourceMethod = factoryPrototype[method] || missingMethod(method);
				switch (aspect) {
				case 'before':
					factoryPrototype[method] = aspectBefore(sourceMethod, <BeforeAdvice> advice);
					break;
				case 'after':
					factoryPrototype[method] = aspectAfter(sourceMethod, <AfterAdvice<any>> advice);
					break;
				case 'around':
					factoryPrototype[method] = aspectAround(sourceMethod, <AroundAdvice<any>> advice);
				}
			});
		}
	}

	/* assign a constructor to the prototype */
	factoryPrototype.constructor = factory;

	/* assign static methods/properties */
	assign(factory, staticMethods, factoryData.staticProperties);

	/* assign factory name */
	const className = options.className ||
		(options.factories && options.factories[0] && options.factories[0].name) ||
		DEFAULT_FACTORY_LABEL;
	assignFactoryName(factory, className);

	/* freeze the factory, so it cannot be accidently modified */
	Object.freeze(factory);

	return factory as ComposeFactory<any, any>;
}

/**
 * A custom type guard that determines if the value is a ComposeFactory
 *
 * @param   value The target to check
 * @returns       Return true if it is a ComposeFactory, otherwise false
 */
export function isComposeFactory(value: any): value is ComposeFactory<any, any> {
	return Boolean(value && privateFactoryData.get(value));
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

/* DEPRECATED - This API will be removed in the future */

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Extend the factory prototype with the supplied object literal, class, or factory
	 *
	 * @deprecated
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
	 * @deprecated
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
 * @deprecated
 * @param base The base compose factory that is being extended
 * @param extension The extension to apply to the compose factory
 */
function extend<T, O, U, P>(base: ComposeFactory<T, O>, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
function extend<T, O, U, P>(base: ComposeFactory<T, O>, className: string, extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
function extend<O>(base: ComposeFactory<any, O>, className: any, extension?: any): ComposeFactory<any, O> {
	deprecated({ message: 'This function will be removed, use "override" instead.', name: 'extend' });
	if (typeof className !== 'string') {
		extension = className;
		className = undefined;
	}

	return createFactory({
		className,
		proto: typeof extension === 'function' ? extension.prototype : extension,
		factories: [ base ]
	});
}

/* Override API */

export interface ComposeFactory<T, O> extends ComposeMixinable<T, O> {
	/**
	 * Override certain properties on the existing factory, returning a new factory.  If the properties
	 * are not present in the existing factory, override will throw.
	 *
	 * @param properties The properties to override
	 */
	override(properties: any): this;

	/**
	 * Override certain properties on the existing factory, returning a new factory.  If the properties
	 * are not present in the existing factory, override with throw.
	 *
	 * @param className The class name for the factory
	 * @param properties The properties to override
	 */
	override(className: string, properties: any): this;
}

export interface Compose {
	/**
	 * Override properties on a compose factory, returning a new factory.  If the properties are not
	 * present on the base factory, override will throw.
	 *
	 * @param baseFactory The base compose factory to override
	 * @param properties The properties to override
	 */
	override<T, O>(baseFactory: ComposeFactory<T, O>, properties: any): ComposeFactory<T, O>;

	/**
	 * Override properties on a compose factory, returning a new factory.  If the properties are not
	 * present on the base factory, override will throw.
	 *
	 * @param baseFactory The base compose factory to override
	 * @param className The class name for the factory
	 * @param properties The properties to override
	 */
	override<T, O>(baseFactory: ComposeFactory<T, O>, className: string, properties: any): ComposeFactory<T, O>;
}

/**
 * The internal implementation of overriding properties on a compose factory
 *
 * @param baseFactory The base factory
 * @param className The name of the class that will be produced by the factory
 * @param properties The object that contains the properties to override
 */
function override<T, O>(baseFactory: ComposeFactory<T, O>, properties: any): ComposeFactory<T, O>;
function override<T, O>(baseFactory: ComposeFactory<T, O>, className: string, properties: any): ComposeFactory<T, O>;
function override<T, O>(baseFactory: ComposeFactory<T, O>, className: any, properties?: any): ComposeFactory<T, O> {
	if (typeof className !== 'string') {
		properties = className;
		className = undefined;
	}

	if (typeof properties !== 'object') {
		throw new TypeError('Argument "properties" must be an object.');
	}

	const base = privateFactoryData.get(baseFactory).base;

	/* TODO: In TypeScript 2.1 we should have `partial` types which can then be used to provide type checking at design time
	 * similiar to this */
	Object.keys(properties).forEach((key) => {
		if (!(key in base)) {
			throw new TypeError(`Attempting to override missing property "${key}"`);
		}
	});

	return createFactory({
		className,
		proto: properties,
		factories: [ baseFactory ]
	});
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
	const factory = createFactory({
		factories: [ base ]
	});
	overlayFunction(factory.prototype);
	return factory;
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
	mixin<U, P>(mixin: ComposeMixinable<U, P>): ComposeFactory<T & U, O & P>;
	mixin<U, P>(mixin: ComposeMixinDescriptor<T, O, U, P>): ComposeFactory<T & U, O & P>;
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
 * Internal function that converts `AspectAdvice` into `AdviceMap` which can then be used for
 * creating a factory
 *
 * @param aspectAdvice The aspect advice to convert into an advice map
 */
function aspectAdviceToAdviceMap(aspectAdvice: AspectAdvice | undefined): AdviceMap | undefined {
	if (!aspectAdvice) {
		return;
	}

	const adviceMap: AdviceMap = {};
	const beforeAdvice = aspectAdvice.before;
	const afterAdvice = aspectAdvice.after;
	const aroundAdvice = aspectAdvice.around;

	function mapAdvice(type: string, key: string, advice: { [ key: string ]: any }) {
		const adviceTuple = [ type, advice[key] ] as AdviceTuple;
		if (adviceMap[key]) {
			adviceMap[key].push(adviceTuple);
		}
		else {
			adviceMap[key] = [ adviceTuple ];
		}
	}

	if (beforeAdvice) {
		objectKeys(beforeAdvice).forEach((key) => {
			/* TODO: Remove ! in 2.1 */
			mapAdvice('before', key, beforeAdvice!);
		});
	}
	if (afterAdvice) {
		objectKeys(afterAdvice).forEach((key) => {
			/* TODO: Remove ! in 2.1 */
			mapAdvice('after', key, afterAdvice!);
		});
	}
	if (aroundAdvice) {
		objectKeys(aroundAdvice).forEach((key) => {
			/* TODO: Remove ! in 2.1 */
			mapAdvice('around', key, aroundAdvice!);
		});
	}
	return adviceMap;
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
	/* ensure we are dealing with a mixinDescriptor */
	const mixinDescriptor = isComposeMixinable(toMixin) ? toMixin.factoryDescriptor() : toMixin;

	/* destructure out most of the factory creation options */
	const { mixin, initialize: initFunction, aspectAdvice, className } = mixinDescriptor;

	/* we will at least be using the base factory to create the new one */
	const factories: ComposeFactory<any, any>[] = [ base ];
	let proto: any;

	/* if mixin is a compose factory, we will pass it as a factory used to create the new factory */
	if (isComposeFactory(mixin)) {
		factories.push(mixin);
	}
	/* otherwise we are dealing with a prototype based mixin */
	else {
		/* of which, we can have a constructor function/class, or an object literal (or undefined) */
		proto = isComposeFactory(mixin) ? undefined : typeof mixin === 'function' ? mixin.prototype : mixin;
	}

	/* convert the advice, if any, to the format used by createFactory */
	const advice = aspectAdviceToAdviceMap(aspectAdvice);

	/* label the initFn */
	if (initFunction) {
		assignFunctionName(
			initFunction,
			`mixin${className || (isComposeFactory(mixin) && mixin.name) || base.name}`
		);
	}

	/* return the newly created factory */
	return createFactory({
		advice,
		factories,
		initFunction,
		className,
		proto
	}) as ComposeFactory<T & U, O & P>;
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
	return createFactory({
		factories: [ this ],
		proto: {
			[method]: base.prototype[method]
		}
	}) as ComposeFactory<T, O>;
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
	return createFactory({
		factories: [ this ],
		advice: {
			[method]: [ [ 'before', advice ] ]
		}
	});
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
	return createFactory({
		factories: [ this ],
		advice: {
			[method]: [ [ 'after', advice ] ]
		}
	});
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
	return createFactory({
		factories: [ this ],
		advice: {
			[method]: [ [ 'around', advice ] ]
		}
	});
}

/**
 * The internal implementation of applying aspect advice to a factory
 *
 * @param base The base factory the advice should be applied to
 * @param advice The advice map to apply to the factory
 */
function aspect<T, O>(base: ComposeFactory<T, O>, advice: AspectAdvice): ComposeFactory<T, O> {
	return createFactory({
		factories: [ base ],
		advice: aspectAdviceToAdviceMap(advice)
	});
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
	/* disambugate arguments */
	if (typeof className !== 'string') {
		initFunction = base;
		base = className;
		className = undefined;
	}

	/* Label the initFunction */
	if (initFunction && className) {
		assignFunctionName(initFunction, `init${className}`);
	}

	let factories: ComposeFactory<any, any>[] | undefined;
	let proto: any;

	/* If base is a compose factory, set it as the factory array */
	if (base && isComposeFactory(base)) {
		factories = [ base ];
	}
	/* Otherwise, we are dealing with a constructor function or a prototype */
	else {
		proto = typeof base === 'function' ? base.prototype : base;
	}

	return createFactory({
		className,
		factories,
		initFunction,
		proto
	});
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
	static<T, O, S>(factory: ComposeFactory<T, O>, staticProperties: S): ComposeFactory<T, O> & S;
}

/**
 * Internal implementation of applying static properties to a compose factory
 *
 * @param factory The factory that the static properties should be applied to
 * @param staticProperties The properties to be applied to the factory
 */
function _static<T, O, S>(base: ComposeFactory<T, O>, staticProperties: S): ComposeFactory<T, O> & S {
	return createFactory({
		factories: [ base ],
		staticProperties
	});
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
	extend, /* DEPRECATED */
	mixin,
	override,
	overlay,
	from,
	before,
	after,
	around,
	aspect
});

export default compose;
