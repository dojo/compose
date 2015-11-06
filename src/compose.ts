import WeakMap from 'dojo-core/WeakMap';
import { assign } from 'dojo-core/lang';
import {
	before as aspectBefore,
	after as aspectAfter,
	around as aspectAround,
	BeforeAdvice,
	AfterAdvice,
	AroundAdvice
} from './aspect';

/* A weakmap that will store initialization functions for compose constructors */
const initFnMap = new WeakMap<Function, ComposeInitializationFunction<any>[]>();

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
const doAspect = rebase(aspect);

/**
 * A convience function to decorate a compose class constructors
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
		initFnMap.get(factory).forEach(fn => fn.apply(instance, args));
		return instance;
	}

	if (base) {
		assign(factory.prototype, base.prototype);
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

/* General Interfaces */

export interface GenericClass<T> {
	new (...args: any[]): T;
	prototype: T;
}

export interface ComposeInitializationFunction<O> {
	(options?: O): void;
}

/* Extension API */
export interface ComposeFactory<O, T> {
	extend<U>(extension: U): ComposeFactory<O, T & U>;
}

export interface Compose {
	extend<O, A, B>(base: ComposeFactory<O, A>, extension: B): ComposeFactory<O, A & B>;
}

function extend<O, A, B>(base: ComposeFactory<O, A>, extension: B): ComposeFactory<O, A & B>;
function extend<O>(base: ComposeFactory<O, any>, extension: any): ComposeFactory<O, any> {
	base = cloneFactory(base);
	Object.keys(extension).forEach(key => base.prototype[key] = extension[key]);
	Object.freeze(base.prototype);
	return base;
}

/* Mixin API */
export interface ComposeFactory<O, T> {
	mixin<P, U>(mixin: GenericClass<U>): ComposeFactory<O, T & U>;
	mixin<P, U>(mixin: ComposeFactory<P, U>): ComposeFactory<O & P, T & U>;
}

export interface Compose {
	mixin<O, A, B>(base: ComposeFactory<O, A>, mixin: GenericClass<B>): ComposeFactory<O, A & B>;
	mixin<O, P, A, B>(base: ComposeFactory<O, A>, mixin: ComposeFactory<P, B>): ComposeFactory<O & P, A & B>;
}

function mixin<O, A, B>(base: ComposeFactory<O, A>, mixin: GenericClass<B>): ComposeFactory<O, A & B>;
function mixin<O, P, A, B>(base: ComposeFactory<O, A>, mixin: ComposeFactory<P, B>): ComposeFactory<O & P, A & B>;
function mixin<O>(base: ComposeFactory<O, any>, mixin: any): ComposeFactory<O, any> {
	base = cloneFactory(base);
	Object.keys(mixin.prototype).forEach(key => base.prototype[key] = mixin.prototype[key]);
	Object.freeze(base.prototype);
	return base;
}

/* Overlay API */
export interface OverlayFunction<T> {
	(proto: T): void;
}

export interface ComposeFactory<O, T> {
	 overlay(overlayFunction: OverlayFunction<T>): ComposeFactory<O, T>;
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

export interface GenericFunction<T> {
	(...args: any[]): T;
}

export interface ComposeFactory<O, T> {
	from(base: GenericClass<any>, method: string): ComposeFactory<O, T>;
	from(base: ComposeFactory<any, any>, method: string): ComposeFactory<O, T>;

	before(method: string, advice: BeforeAdvice): ComposeFactory<O, T>;
	after<P>(method: string, advice: AfterAdvice<P>): ComposeFactory<O, T>;
	around<P>(method: string, advice: AroundAdvice<P>): ComposeFactory<O, T>;

	aspect(advice: AspectAdvice): ComposeFactory<O, T>;
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
export interface ComposeFactory<O, T> {
	(options?: O): T;
	prototype: T;
}

export interface Compose {
	<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O>): ComposeFactory<O, A>;
	<O, A, P>(base: ComposeFactory<O, A>, initFunction?: ComposeInitializationFunction<P>): ComposeFactory<O & P, A>;
	<O, A>(base: A, initFunction?: ComposeInitializationFunction<O>): ComposeFactory<O, A>;
	create<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O>): ComposeFactory<O, A>;
	create<O, A, P>(base: ComposeFactory<O, A>, initFunction?: ComposeInitializationFunction<P>): ComposeFactory<O & P, A>;
	create<O, A>(base: A, initFunction?: ComposeInitializationFunction<O>): ComposeFactory<O, A>;
}

function create<O, A>(base: GenericClass<A>, initFunction?: ComposeInitializationFunction<O>): ComposeFactory<O, A>;
function create<O, A, P>(base: ComposeFactory<O, A>, initFunction?: ComposeInitializationFunction<P>): ComposeFactory<O & P, A>;
function create<O, A>(base: A, initFunction?: ComposeInitializationFunction<O>): ComposeFactory<O, A>;
function create<O>(base: any, initFunction?: ComposeInitializationFunction<O>): any {
	const factory = cloneFactory();
	if (initFunction) {
		initFnMap.get(factory).push(initFunction);
	}

	/* mixin the base into the prototype */
	assign(factory.prototype, typeof base === 'function' ? base.prototype : base);

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
