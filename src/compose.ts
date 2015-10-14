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
}

/**
 * Take a compose constructor and clone it
 * @param  {ComposeClass<O, T>} base The base to clone
 * @return {ComposeClass<O, T>}      The cloned constructor function
 */
function cloneCreator<O, T>(base?: ComposeClass<O, T>): ComposeClass<O, T>;
function cloneCreator(base?: any): any {
	function Creator(...args: any[]): any {
		initFnMap.get(this.constructor).forEach(fn => fn.apply(this, args));
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

/* AOP/Inheritance API */

export interface GenericFunction<T> {
    (...args: any[]): T;
}

export interface ComposeClass<O, T> {
    from(base: GenericClass<any>, method: string): ComposeClass<O, T>;
    from(base: ComposeClass<any, any>, method: string): ComposeClass<O, T>;

    before(method: string, advice: BeforeAdvice): ComposeClass<O, T>;
    after<P>(method: string, advice: AfterAdvice<P>): ComposeClass<O, T>;
    around<P>(method: string, advice: AroundAdvice<P>): ComposeClass<O, T>;
}

export interface Compose {
    from<T extends Function>(base: GenericClass<any>, method: string): T;
    from<T extends Function>(base: ComposeClass<any, any>, method: string): T;

    before<T>(base: GenericClass<any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
    before<T>(base: ComposeClass<any, any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
    before<T>(method: GenericFunction<T>, advice: BeforeAdvice): GenericFunction<T>;

    after<T>(base: GenericClass<any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
    after<T>(base: ComposeClass<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
    after<T>(method: GenericFunction<T>, advice: AfterAdvice<T>): GenericFunction<T>;

    around<T>(base: GenericClass<any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
    around<T>(base: ComposeClass<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
    around<T>(method: GenericFunction<T>, advice: AroundAdvice<T>): GenericFunction<T>;
}

function from<T extends Function>(base: GenericClass<any>, method: string): T;
function from<T extends Function>(base: ComposeClass<any, any>, method: string): T;
function from<T extends Function>(base: any, method: string): T {
    return base.prototype[method];
}

function doFrom<O, T>(base: GenericClass<any>, method: string): ComposeClass<O, T>;
function doFrom<O, T>(base: ComposeClass<any, any>, method: string): ComposeClass<O, T>;
function doFrom(base: any, method: string): ComposeClass<any, any> {
    const clone = cloneCreator(this);
    clone.prototype[method] = base.prototype[method];
    return clone;
}

function before<T>(base: GenericClass<any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
function before<T>(base: ComposeClass<any, any>, method: string, advice: BeforeAdvice): GenericFunction<T>;
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

function doBefore<O, T>(method: string, advice: BeforeAdvice): ComposeClass<O, T> {
    const clone = cloneCreator(this);
    clone.prototype[method] = aspectBefore(clone.prototype[method], advice);
    return <ComposeClass<O, T>> clone;
}

function after<T>(base: GenericClass<any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
function after<T>(base: ComposeClass<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
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

function doAfter<O, P, T>(method: string, advice: AfterAdvice<P>): ComposeClass<O, T> {
    const clone = cloneCreator(this);
    clone.prototype[method] = aspectAfter(clone.prototype[method], advice);
    return <ComposeClass <O, T>> clone;
}

function around<T>(base: GenericClass<any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
function around<T>(base: ComposeClass<any, any>, method: string, advice: AfterAdvice<T>): GenericFunction<T>;
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

function doAround<O, P, T>(method: string, advice: AroundAdvice<P>): ComposeClass<O, T> {
    const clone = cloneCreator(this);
    clone.prototype[method] = aspectAround(clone.prototype[method], advice);
    return <ComposeClass <O, T>> clone;
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
(<Compose> create).from = from;
(<Compose> create).before = before;
(<Compose> create).after = after;
(<Compose> create).around = around;

const compose: Compose = <Compose> create;

export default compose;
