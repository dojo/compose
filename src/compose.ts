import WeakMap from 'dojo-core/WeakMap';
import { assign } from 'dojo-core/lang';

/* A weakmap that will store initialization functions for compose constructors */
let initFnMap = new WeakMap<Function, Function[]>();

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

/* The rebased functions we need to decorate compose constructors with */
const doExtend = rebase(extend);
const doMixin = rebase(mixin);
const doOverlay = rebase(overlay);

/**
 * A convience function to decorate a compose class constructors
 * @param {any} base The target constructor
 */
function stamp(base: any): void {
   base.extend = doExtend;
   base.mixin = doMixin;
   base.overlay = doOverlay;
}

/**
 * Take a compose constructor and clone it
 * @param  {ComposeClass<O, T>} base The base to clone
 * @return {ComposeClass<O, T>}      The cloned constructor function
 */
function cloneCreator<O, T>(base?: ComposeClass<O, T>): ComposeClass<O, T>;
function cloneCreator(base?: any): any {
	function Creator(...args: any[]): any {
		const initFns = initFnMap.get(this.constructor);
		if (initFns) {
			initFns.forEach(fn => fn.apply(this, args));
		}
	}

	if (base) {
		assign(Creator.prototype, base.prototype);
		initFnMap.set(Creator, [].concat(initFnMap.get(base)));
	}
	else {
		initFnMap.set(Creator, []);
	}
	Creator.prototype.constructor = Creator;
	stamp(Creator);
	Object.freeze(Creator);

	return Creator;
}

/* General Interfaces */

export interface GenericClass<T> {
	new (...args: any[]): T;
}

export interface ComposeInitializationFunction<O> {
	(options?: O): void;
}

/* Extension API */
export interface ComposeClass<O, T> {
	extend<U>(extension: U): ComposeClass<O, T & U>;
}

export interface Compose {
	extend<O, A, B>(base: ComposeClass<O, A>, extension: B): ComposeClass<O, A & B>;
}

function extend<O, A, B>(base: ComposeClass<O, A>, extension: B): ComposeClass<O, A & B>;
function extend<O>(base: ComposeClass<O, any>, extension: any): ComposeClass<O, any> {
	base = cloneCreator(base);
	Object.keys(extension).forEach(key => base.prototype[key] = extension[key]);
	Object.freeze(base.prototype);
	return base;
}

/* Mixin API */
export interface ComposeClass<O, T> {
	mixin<P, U>(mixin: ComposeClass<P, U>): ComposeClass<O&P, T & U>;
	mixin<P, U>(mixin: GenericClass<U>): ComposeClass<O, T & U>;
}

export interface Compose {
	mixin<O, P, A, B>(base: ComposeClass<O, A>, mixin: ComposeClass<P, B>): ComposeClass<O & P, A & B>;
	mixin<O, A, B>(base: ComposeClass<O, A>, mixin: GenericClass<B>): ComposeClass<O, A & B>;
}

function mixin<O, P, A, B>(base: ComposeClass<O, A>, mixin: ComposeClass<P, B>): ComposeClass<O & P, A & B>;
function mixin<O, A, B>(base: ComposeClass<O, A>, mixin: GenericClass<B>): ComposeClass<O, A & B>;
function mixin<O>(base: ComposeClass<O, any>, mixin: any): ComposeClass<O, any> {
	base = cloneCreator(base);
	Object.keys(mixin.prototype).forEach(key => base.prototype[key] = mixin.prototype[key]);
	Object.freeze(base.prototype);
	return base;
}

/* Overlay API */
export interface OverlayFunction<T> {
	(proto: T): void;
}

export interface ComposeClass<O, T> {
	 overlay(overlayFunction: OverlayFunction<T>): ComposeClass<O, T>;
}

export interface Compose {
	overlay<O, A>(base: ComposeClass<O, A>, overlayFunction: OverlayFunction<A>): ComposeClass<O, A>;
}

function overlay<O, A>(base: ComposeClass<O, A>, overlayFunction: OverlayFunction<A>): ComposeClass<O, A> {
	base = cloneCreator(base);
	overlayFunction(base.prototype);
	return base;
}

/* Creation API */
export interface ComposeClass<O, T> {
	new (options?: O): T;
}

export interface Compose {
	<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O>): ComposeClass<O, A>;
	<O, A, P>(base: ComposeClass<O, A>, initFunction?: ComposeInitializationFunction<P>): ComposeClass<O & P, A>;
	<O, A>(base: A, initFunction?: ComposeInitializationFunction<O>): ComposeClass<O, A>;
	create<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O>): ComposeClass<O, A>;
	create<O, A, P>(base: ComposeClass<O, A>, initFunction?: ComposeInitializationFunction<P>): ComposeClass<O & P, A>;
	create<O, A>(base: A, initFunction?: ComposeInitializationFunction<O>): ComposeClass<O, A>;
}

function create<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O>): ComposeClass<O, A>;
function create<O, A, P>(base: ComposeClass<O, A>, initFunction?: ComposeInitializationFunction<P>): ComposeClass<O & P, A>;
function create<O, A>(base: A, initFunction?: ComposeInitializationFunction<O>): ComposeClass<O, A>;
function create<O>(base: any, initFunction?: ComposeInitializationFunction<O>): any {
	const Creator = cloneCreator();
	if (initFunction) {
		initFnMap.get(Creator).push(initFunction);
	}

	/* mixin the base into the prototype */
	assign(Creator.prototype, typeof base === 'function' ? base.prototype : base);

   /* return the new constructor */
   return Creator;
}

/* Generate compose */
(<Compose> create).create = create;
(<Compose> create).extend = extend;
(<Compose> create).mixin = mixin;
(<Compose> create).overlay = overlay;

const compose: Compose = <Compose> create;

export default compose;
