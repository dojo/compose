import WeakMap from 'dojo-core/WeakMap';
import {
	before as aspectBefore,
	after as aspectAfter,
	around as aspectAround,
	BeforeAdvice,
	AfterAdvice,
	AroundAdvice
} from './aspect';

/* A weakmap that will store initialization functions for compose constructors */
const initFnMap = new WeakMap<Function, ComposeInitializationFunction<any, any>[]>();

/**
 * A helper funtion to return a function that is rebased
 * @param  {Function} fn The function to be rebased
 * @return {Function}    The rebased function
 */
function rebase(fn: Function): Function {
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
const doExtend = rebase(extend);
const doMixin = rebase(mixin);
const doOverlay = rebase(overlay);
const doAspect = rebase(aspect);

/**
 * A convenience function to decorate compose class constructors
 * @param {any} base The target constructor
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
}

/**
 * Take a compose constructor and clone it
 * @param  {ComposeFactory<T, O>} base The base to clone
 * @return {ComposeFactory<T, O>}      The cloned constructor function
 */
function cloneFactory<T, O>(base?: ComposeFactory<T, O>): ComposeFactory<T, O>;
function cloneFactory(base?: any): any {
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
export function isComposeFactory(value: any): value is ComposeFactory< any, any > {
	return Boolean(initFnMap.get(value));
}

/* General Interfaces */

export interface GenericClass<T> {
	new (...args: any[]): T;
	prototype: T;
}

export interface ComposeInitializationFunction<T, O> {
	(instance: T, options?: O): void;
}

/* Extension API */
export interface ComposeFactory<T, O> {
	extend<U>(extension: U | GenericClass<U>): ComposeFactory<T & U, O>;
	extend<U, P>(extension: ComposeFactory<U, P>): ComposeFactory<T & U, O & P>;
}

export interface Compose {
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
	(proto: T): void;
}

export interface ComposeFactory<T, O> {
	 overlay(overlayFunction: OverlayFunction<T>): ComposeFactory<T, O>;
}

export interface Compose {
	overlay<T, O>(base: ComposeFactory<T, O>, overlayFunction: OverlayFunction<T>): ComposeFactory<T, O>;
}

function overlay<T, O>(base: ComposeFactory<T, O>, overlayFunction: OverlayFunction<T>): ComposeFactory<T, O> {
	base = cloneFactory(base);
	overlayFunction(base.prototype);
	return base;
}

/* AOP/Inheritance API */

export interface AspectAdvice {
	before?: { [method: string]: BeforeAdvice };
	after?: { [method: string]: AfterAdvice<any> };
	around?: { [method: string]: AroundAdvice<any> };
}

/* Mixin API */
export type ComposeMixinItem<T, O> = GenericClass<T> | T | ComposeFactory<T, O>;

export interface ComposeMixin<T, O, U, P, V, Q, W, R, X, S, Y, Z> {
	mixin?: ComposeMixinItem<U, P>;
	mixins?: [ ComposeMixinItem<U, P>, ComposeMixinItem<V, Q> ]
		| [ ComposeMixinItem<U, P>, ComposeMixinItem<V, Q>, ComposeMixinItem<W, R> ]
		| [ ComposeMixinItem<U, P>, ComposeMixinItem<V, Q>, ComposeMixinItem<W, R>, ComposeMixinItem<X, S> ]
		| [ ComposeMixinItem<U, P>, ComposeMixinItem<V, Q>, ComposeMixinItem<W, R>, ComposeMixinItem<X, S>, ComposeMixinItem<Y, Z>];
	initializer?: ComposeInitializationFunction<T & U & V & W & X & Y, O & P & Q & R & S & Z>;
	aspectAdvice?: AspectAdvice;
}

export interface ComposeFactory<T, O> {
	mixin<U, P, V, Q, W, R, X, S, Y, Z>(mixin: ComposeMixin<T, O, U, P, V, Q, W, R, X, S, Y, Z>):
		ComposeFactory<T & U & V & W & X & Y, O & P & Q & R & S & Z>;
}

export interface Compose {
	mixin<T, O, U, P, V, Q, W, R, X, S, Y, Z>(
		base: ComposeFactory<T, O>,
		mixin: ComposeMixin<T, O, U, P, V, Q, W, R, X, S, Y, Z>
	): ComposeFactory<T & U & V & W & X & Y, O & P & Q & R & S & Z>;
}

function mixin<T, O, U, P, V, Q, W, R, X, S, Y, Z>(
	base: ComposeFactory<T, O>,
	mixin: ComposeMixin<T, O, U, P, V, Q, W, R, X, S, Y, Z>
): ComposeFactory<T & U & V & W & X & Y, O & P & Q & R & S & Z>;

function mixin<O>(base: ComposeFactory<any, O>, toMixin: any): ComposeFactory<any, O> {
	base = cloneFactory(base);
	const baseInitFns = initFnMap.get(base);
	const mixinType = (toMixin.mixins && toMixin.mixins.length) ? toMixin.mixins[0] : toMixin.mixin;
	if (mixinType) {
		let mixinFactory = isComposeFactory(mixinType) ? mixinType : create(mixinType);
		if (toMixin.initializer) {
			if (baseInitFns.indexOf(toMixin.initializer) < 0) {
				baseInitFns.unshift(toMixin.initializer);
			}
		}
		concatInitFn(base, mixinFactory);
		copyProperties(base.prototype, mixinFactory.prototype);
	} else if (toMixin.initializer) {
		if (baseInitFns.indexOf(toMixin.initializer) < 0) {
			baseInitFns.unshift(toMixin.initializer);
		}
	}
	if (toMixin.aspectAdvice) {
		base = aspect(base, toMixin.aspectAdvice);
	}
	if (toMixin.mixins && toMixin.mixins.length > 1) {
		return mixin(base, {
			mixins: toMixin.mixins.slice(1),
		});
	} else {
		return base;
	}
}

export interface GenericFunction<T> {
	(...args: any[]): T;
}

export interface ComposeFactory<T, O> {
	from(base: GenericClass<any>, method: string): ComposeFactory<T, O>;
	from(base: ComposeFactory<any, any>, method: string): ComposeFactory<T, O>;

	before(method: string, advice: BeforeAdvice): ComposeFactory<T, O>;
	after<P>(method: string, advice: AfterAdvice<P>): ComposeFactory<T, O>;
	around<P>(method: string, advice: AroundAdvice<P>): ComposeFactory<T, O>;

	aspect(advice: AspectAdvice): ComposeFactory<T, O>;
}

export interface Compose {
	from<T extends Function>(base: GenericClass<any>, method: string): T;
	from<T extends Function>(base: ComposeFactory<any, any>, method: string): T;

	before<T>(base: GenericClass<any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
	before<T>(base: ComposeFactory<any, any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
	before<T>(method: GenericFunction<T>, advice: BeforeAdvice): GenericFunction<T>;

	after<T>(base: GenericClass<any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
	after<T>(base: ComposeFactory<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
	after<T>(method: GenericFunction<T>, advice: AfterAdvice<T>): GenericFunction<T>;

	around<T>(base: GenericClass<any>, method: string, advice: AroundAdvice<T>): GenericFunction<T>;
	around<T>(base: ComposeFactory<any, any>, method: string, advice: AroundAdvice<T>): GenericFunction<T>;
	around<T>(method: GenericFunction<T>, advice: AroundAdvice<T>): GenericFunction<T>;

	aspect<O, A>(base: ComposeFactory<O, A>, advice: AspectAdvice): ComposeFactory<O, A>;
}

function from<T extends Function>(base: GenericClass<any>, method: string): T;
function from<T extends Function>(base: ComposeFactory<any, any>, method: string): T;
function from<T extends Function>(base: any, method: string): T {
	return base.prototype[method];
}

function doFrom<T, O>(base: GenericClass<any>, method: string): ComposeFactory<T, O>;
function doFrom<T, O>(base: ComposeFactory<any, any>, method: string): ComposeFactory<T, O>;
function doFrom(base: any, method: string): ComposeFactory<any, any> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = base.prototype[method];
	return clone;
}

function before<T>(base: GenericClass<any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
function before<T>(base: ComposeFactory<any, any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
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

function after<T>(base: GenericClass<any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
function after<T>(base: ComposeFactory<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
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

function around<T>(base: GenericClass<any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
function around<T>(base: ComposeFactory<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
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
export interface ComposeFactory<T, O> {
	(options?: O): T;
	prototype: T;
}

export interface Compose {
	<T, O>(base: GenericClass<T>, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, P>): ComposeFactory<T, O & P>;
	<T, O>(base: T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	create<T, O>(base: GenericClass<T>, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
	create<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, P>): ComposeFactory<T, O & P>;
	create<T, O>(base: T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
}

function create<T, O>(base: GenericClass<T>, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
function create<T, O, P>(base: ComposeFactory<T, O>, initFunction?: ComposeInitializationFunction<T, P>): ComposeFactory<T, O & P>;
function create<T, O>(base: T, initFunction?: ComposeInitializationFunction<T, O>): ComposeFactory<T, O>;
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

/* Generate compose */
(<Compose> create).create = create;
(<Compose> create).extend = extend;
(<Compose> create).mixin = mixin;
(<Compose> create).overlay = overlay;
(<Compose> create).from = from;
(<Compose> create).before = before;
(<Compose> create).after = after;
(<Compose> create).around = around;
(<Compose> create).aspect = aspect;

const compose: Compose = <Compose> create;

export default compose;
