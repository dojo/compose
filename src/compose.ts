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
 * @param  {ComposeFactory<O, T>} base The base to clone
 * @return {ComposeFactory<O, T>}      The cloned constructor function
 */
function cloneFactory<O, T>(base?: ComposeFactory<O, T>): ComposeFactory<O, T>;
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
function concatInitFn<O, T, P, S>(target: ComposeFactory<O, T>, source: ComposeFactory<P, S>): void {
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

export interface ComposeInitializationFunction<O, T> {
	(instance: T, options?: O): void;
}

/* Extension API */
export interface ComposeFactory<K, A> {
	extend<U>(extension: U): ComposeFactory<K, A & U>;
}

export interface Compose {
	extend<O, A, B>(base: ComposeFactory<O, A>, extension: B): ComposeFactory<O, A & B>;
}

function extend<O, A, B>(base: ComposeFactory<O, A>, extension: B): ComposeFactory<O, A & B>;
function extend<O>(base: ComposeFactory<O, any>, extension: any): ComposeFactory<O, any> {
	base = cloneFactory(base);
	copyProperties(base.prototype, extension);
	return base;
}

/* Overlay API */
export interface OverlayFunction<T> {
	(proto: T): void;
}

export interface ComposeFactory<K, A> {
	 overlay(overlayFunction: OverlayFunction<A>): ComposeFactory<K, A>;
}

export interface Compose {
	overlay<O, A>(base: ComposeFactory<O, A>, overlayFunction: OverlayFunction<A>): ComposeFactory<O, A>;
}

function overlay<O, A>(base: ComposeFactory<O, A>, overlayFunction: OverlayFunction<A>): ComposeFactory<O, A> {
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
export interface ComposeMixin<A, O, P, T> {
	mixin?: GenericClass<P> | P | ComposeFactory<T, P>;
	initializer?: ComposeInitializationFunction<O, P & A>;
	aspectAdvice?: AspectAdvice;
}

export interface ComposeFactory<K, A> {
	mixin<L, B, T>(mixin: ComposeMixin<A, T, B, L>): ComposeFactory<K & L, A & B>;

	// Overloads for multiple mixins
	mixin<L, M, B, C, T, U>(
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>
	): ComposeFactory<K & L & M, A & B & C>;

	mixin<L, M, N, B, C, D, T, U, V>(
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>
	): ComposeFactory<K & L & M & N, A & B & C & D>;

	mixin<L, M, N, O, B, C, D, E, T, U, V, W>(
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>,
		fourthMixin: ComposeMixin<A, W, E, O>
	): ComposeFactory<K & L & M & N & O, A & B & C & D & E>;

	mixin<L, M, N, O, P, B, C, D, E, F, T, U, V, W, X>(
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>,
		fourthMixin: ComposeMixin<A, W, E, O>,
		fifthMixin: ComposeMixin<A, X, F, P>
	): ComposeFactory<K & L & M & N & O & P, A & B & C & D & E & F>;

	mixin<L, M, N, O, P, Q, B, C, D, E, F, G, T, U, V, W, X, Y>(
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>,
		fourthMixin: ComposeMixin<A, W, E, O>,
		fifthMixin: ComposeMixin<A, X, F, P>,
		sixthMixin: ComposeMixin<A, Y, G, Q>
	): ComposeFactory<K & L & M & N & O & P & Q, A & B & C & D & E & F & G>;

	mixin<L, M, N, O, P, Q, R, B, C, D, E, F, G, H, T, U, V, W, X, Y, Z>(
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>,
		fourthMixin: ComposeMixin<A, W, E, O>,
		fifthMixin: ComposeMixin<A, X, F, P>,
		sixthMixin: ComposeMixin<A, Y, G, Q>,
		seventhMixin: ComposeMixin<A, Z, H, R>
	): ComposeFactory<K & L & M & N & O & P & Q & R, A & B & C & D & E & F & G & H>;
}

export interface Compose {
	mixin<K, L, A, B, T>(
		base: ComposeFactory<K, A>,
		mixin: ComposeMixin<A, T, B, L>
	): ComposeFactory<K & L, A & B>;

	// Overloads for multiple mixins
	mixin<K, L, M, A, B, C, T, U>(
		base: ComposeFactory<K, A>,
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>
	): ComposeFactory<K & L & M, A & B & C>;

	mixin<K, L, M, N, A, B, C, D, T, U, V>(
		base: ComposeFactory<K, A>,
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>
	): ComposeFactory<K & L & M & N, A & B & C & D>;

	mixin<K, L, M, N, O, A, B, C, D, E, T, U, V, W>(
		base: ComposeFactory<K, A>,
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>,
		fourthMixin: ComposeMixin<A, W, E, O>
	): ComposeFactory<K & L & M & N & O, A & B & C & D & E>;

	mixin<K, L, M, N, O, P, A, B, C, D, E, F, T, U, V, W, X>(
		base: ComposeFactory<K, A>,
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>,
		fourthMixin: ComposeMixin<A, W, E, O>,
		fifthMixin: ComposeMixin<A, X, F, P>
	): ComposeFactory<K & L & M & N & O & P, A & B & C & D & E & F>;

	mixin<K, L, M, N, O, P, Q, A, B, C, D, E, F, G, T, U, V, W, X, Y>(
		base: ComposeFactory<K, A>,
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>,
		fourthMixin: ComposeMixin<A, W, E, O>,
		fifthMixin: ComposeMixin<A, X, F, P>,
		sixthMixin: ComposeMixin<A, Y, G, Q>
	): ComposeFactory<K & L & M & N & O & P & Q, A & B & C & D & E & F & G>;

	mixin<K, L, M, N, O, P, Q, R, A, B, C, D, E, F, G, H, T, U, V, W, X, Y, Z>(
		base: ComposeFactory<K, A>,
		mixin: ComposeMixin<A, T, B, L>,
		secondMixin: ComposeMixin<A, U, C, M>,
		thirdMixin: ComposeMixin<A, V, D, N>,
		fourthMixin: ComposeMixin<A, W, E, O>,
		fifthMixin: ComposeMixin<A, X, F, P>,
		sixthMixin: ComposeMixin<A, Y, G, Q>,
		seventhMixin: ComposeMixin<A, Z, H, R>
	): ComposeFactory<K & L & M & N & O & P & Q & R, A & B & C & D & E & F & G & H>;
}

function mixin<K, L, A, B, T>(
	base: ComposeFactory<K, A>,
	mixin: ComposeMixin<A, T, B, L>
): ComposeFactory<K & L, A & B>;

// Overloads for multiple mixins
function mixin<K, L, M, A, B, C, T, U>(
	base: ComposeFactory<K, A>,
	mixin: ComposeMixin<A, T, B, L>,
	secondMixin: ComposeMixin<A, U, C, M>
): ComposeFactory<K & L & M, A & B & C>;

function mixin<K, L, M, N, A, B, C, D, T, U, V>(
	base: ComposeFactory<K, A>,
	mixin: ComposeMixin<A, T, B, L>,
	secondMixin: ComposeMixin<A, U, C, M>,
	thirdMixin: ComposeMixin<A, V, D, N>
): ComposeFactory<K & L & M & N, A & B & C & D>;

function mixin<K, L, M, N, O, A, B, C, D, E, T, U, V, W>(
	base: ComposeFactory<K, A>,
	mixin: ComposeMixin<A, T, B, L>,
	secondMixin: ComposeMixin<A, U, C, M>,
	thirdMixin: ComposeMixin<A, V, D, N>,
	fourthMixin: ComposeMixin<A, W, E, O>
): ComposeFactory<K & L & M & N & O, A & B & C & D & E>;

function mixin<K, L, M, N, O, P, A, B, C, D, E, F, T, U, V, W, X>(
	base: ComposeFactory<K, A>,
	mixin: ComposeMixin<A, T, B, L>,
	secondMixin: ComposeMixin<A, U, C, M>,
	thirdMixin: ComposeMixin<A, V, D, N>,
	fourthMixin: ComposeMixin<A, W, E, O>,
	fifthMixin: ComposeMixin<A, X, F, P>
): ComposeFactory<K & L & M & N & O & P, A & B & C & D & E & F>;

function mixin<K, L, M, N, O, P, Q, A, B, C, D, E, F, G, T, U, V, W, X, Y>(
	base: ComposeFactory<K, A>,
	mixin: ComposeMixin<A, T, B, L>,
	secondMixin: ComposeMixin<A, U, C, M>,
	thirdMixin: ComposeMixin<A, V, D, N>,
	fourthMixin: ComposeMixin<A, W, E, O>,
	fifthMixin: ComposeMixin<A, X, F, P>,
	sixthMixin: ComposeMixin<A, Y, G, Q>
): ComposeFactory<K & L & M & N & O & P & Q, A & B & C & D & E & F & G>;

function mixin<K, L, M, N, O, P, Q, R, A, B, C, D, E, F, G, H, T, U, V, W, X, Y, Z>(
	base: ComposeFactory<K, A>,
	mixin: ComposeMixin<A, T, B, L>,
	secondMixin: ComposeMixin<A, U, C, M>,
	thirdMixin: ComposeMixin<A, V, D, N>,
	fourthMixin: ComposeMixin<A, W, E, O>,
	fifthMixin: ComposeMixin<A, X, F, P>,
	sixthMixin: ComposeMixin<A, Y, G, Q>,
	seventhMixin: ComposeMixin<A, Z, H, R>
): ComposeFactory<K & L & M & N & O & P & Q & R, A & B & C & D & E & F & G & H>;

function mixin<A>(base: ComposeFactory<A, any>, firstMixin: any, secondMixin?: any, thirdMixin?: any, fourthMixin?: any, fifthMixin?: any, sixthMixin?: any, seventhMixin?: any): ComposeFactory<A, any> {
	base = cloneFactory(base);
	const baseInitFns = initFnMap.get(base);
	if (firstMixin.mixin) {
		let mixinFactory = isComposeFactory(firstMixin.mixin) ? firstMixin.mixin : create(firstMixin.mixin);
		if (firstMixin.initializer) {
			if (baseInitFns.indexOf(firstMixin.initializer) < 0) {
				baseInitFns.unshift(firstMixin.initializer);
			}
		}
		concatInitFn(base, mixinFactory);
		copyProperties(base.prototype, mixinFactory.prototype);
	} else if (firstMixin.initializer) {
		if (baseInitFns.indexOf(firstMixin.initializer) < 0) {
			baseInitFns.unshift(firstMixin.initializer)
		}
	}
	if (firstMixin.aspectAdvice) {
		base = aspect(base, firstMixin.aspectAdvice);
	}
	if (secondMixin) {
		const args = Array.prototype.slice.call(arguments, 2);
		args.unshift(base);
		return mixin.apply(null, args);
	} else {
		return base;
	}
}

export interface GenericFunction<T> {
	(...args: any[]): T;
}

export interface ComposeFactory<K, A> {
	from(base: GenericClass<any>, method: string): ComposeFactory<K, A>;
	from(base: ComposeFactory<any, any>, method: string): ComposeFactory<K, A>;

	before(method: string, advice: BeforeAdvice): ComposeFactory<K, A>;
	after<P>(method: string, advice: AfterAdvice<P>): ComposeFactory<K, A>;
	around<P>(method: string, advice: AroundAdvice<P>): ComposeFactory<K, A>;

	aspect(advice: AspectAdvice): ComposeFactory<K, A>;
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

function doFrom<O, T>(base: GenericClass<any>, method: string): ComposeFactory<O, T>;
function doFrom<O, T>(base: ComposeFactory<any, any>, method: string): ComposeFactory<O, T>;
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

function doBefore<O, T>(method: string, advice: BeforeAdvice): ComposeFactory<O, T> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectBefore((<any> clone.prototype)[method], advice);
	return <ComposeFactory<O, T>> clone;
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

function doAfter<O, P, T>(method: string, advice: AfterAdvice<P>): ComposeFactory<O, T> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectAfter((<any> clone.prototype)[method], advice);
	return <ComposeFactory <O, T>> clone;
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

function doAround<O, P, T>(method: string, advice: AroundAdvice<P>): ComposeFactory<O, T> {
	const clone = cloneFactory(this);
	(<any> clone.prototype)[method] = aspectAround((<any> clone.prototype)[method], advice);
	return <ComposeFactory <O, T>> clone;
}

function aspect<O, A>(base: ComposeFactory<O, A>, advice: AspectAdvice): ComposeFactory<O, A> {
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
export interface ComposeFactory<K, A> {
	(options?: K): A;
	prototype: A;
}

export interface Compose {
	<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O, A>): ComposeFactory<O, A>;
	<O, A, P>(base: ComposeFactory<O, A>, initFunction?: ComposeInitializationFunction<P, A>): ComposeFactory<O & P, A>;
	<O, A>(base: A, initFunction?: ComposeInitializationFunction<O, A>): ComposeFactory<O, A>;
	create<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O, A>): ComposeFactory<O, A>;
	create<O, A, P>(base: ComposeFactory<O, A>, initFunction?: ComposeInitializationFunction<P, A>): ComposeFactory<O & P, A>;
	create<O, A>(base: A, initFunction?: ComposeInitializationFunction<O, A>): ComposeFactory<O, A>;
}

function create<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O, A>): ComposeFactory<O, A>;
function create<O, A, P>(base: ComposeFactory<O, A>, initFunction?: ComposeInitializationFunction<P, A>): ComposeFactory<O & P, A>;
function create<O, A>(base: A, initFunction?: ComposeInitializationFunction<O, A>): ComposeFactory<O, A>;
function create<O>(base: any, initFunction?: ComposeInitializationFunction<O, any>): any {
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
