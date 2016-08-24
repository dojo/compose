import WeakMap from 'dojo-shim/WeakMap';

export interface AdvisingFunction extends Function {
	/**
	 * The next advice in an advice chain
	 */
	readonly next: AdvisingFunction;

	/**
	 * The previous advice in an advice chain
	 */
	readonly previous: AdvisingFunction;
}

export interface DispatchAdvice<T> {
	before?: BeforeAdvice[];
	after?: AfterAdvice<T>[];
	readonly joinPoint: Function;
}

export interface BeforeAdvice {
	/**
	 * Advice which is applied *before*, receiving the original arguments, if the advising
	 * function returns a value, it is passed further along taking the place of the original
	 * arguments.
	 *
	 * @param args The arguments the method was called with
	 */
	(...args: any[]): any[] | void;
}

export interface AfterAdvice<T> {
	/**
	 * Advice which is applied *after*, receiving the result and arguments from the join point.
	 *
	 * @param result The result from the function being advised
	 * @param args The arguments that were supplied to the advised function
	 * @returns The value returned from the advice is then the result of calling the method
	 */
	(result: T, ...args: any[]): T;
}

export interface AroundAdvice<T> {
	/**
	 * Advice which is applied *around*.  The advising function receives the original function and
	 * needs to return a new function which will then invoke the original function.
	 *
	 * @param origFn The original function
	 * @returns A new function which will inoke the original function.
	 */
	(origFn: GenericFunction<T>): (...args: any[]) => T;
}

/**
 * Types of advice
 */
export enum AdviceType { Before, After, Around };

/**
 * A weak map of dispatchers used to apply the advice
 */
const dispatchAdviceMap = new WeakMap<Function, DispatchAdvice<any>>();

export interface GenericFunction<T> {
	(...args: any[]): T;
}

/**
 * Returns the dispatcher function for a given joinPoint (method/function)
 *
 * @param joinPoint The function that is to be advised
 */
function getDispatcher<F extends GenericFunction<T>, T>(joinPoint: F): F {

	function dispatcher(this: Function, ...args: any[]): T {
		const { before, after, joinPoint } = dispatchAdviceMap.get(dispatcher);
		if (before) {
			args = before.reduce((previousArgs, advice) => {
				const currentArgs = advice.apply(this, previousArgs);
				return currentArgs || previousArgs;
			}, args);
		}
		let result = joinPoint.apply(this, args);
		if (after) {
			result = after.reduce((previousResult, advice) => {
				return advice.apply(this, [ previousResult ].concat(args));
			}, result);
		}
		return result;
	}

	/* We want to "clone" the advice that has been applied already, if this
	 * joinPoint is already advised */
	if (dispatchAdviceMap.has(joinPoint)) {
		const adviceMap = dispatchAdviceMap.get(joinPoint);
		let { before, after } = adviceMap;
		if (before) {
			before = before.slice(0);
		}
		if (after) {
			after = after.slice(0);
		}
		dispatchAdviceMap.set(dispatcher, {
			joinPoint: adviceMap.joinPoint,
			before,
			after
		});
	}
	/* Otherwise, this is a new joinPoint, so we will create the advice map afresh */
	else {
		dispatchAdviceMap.set(dispatcher, { joinPoint });
	}

	return dispatcher as F;
}

/**
 * Advise a join point (function) with supplied advice
 *
 * @param joinPoint The function to be advised
 * @param type The type of advice to be applied
 * @param advice The advice to apply
 */
function advise<F extends GenericFunction<T>, T>(this: any, joinPoint: F, type: AdviceType, advice: BeforeAdvice | AfterAdvice<T> | AroundAdvice<T>): F {
	let dispatcher: F;
	if (type === AdviceType.Around) {
		dispatcher = getDispatcher(advice.apply(this, [ joinPoint ]));
	}
	else {
		dispatcher = getDispatcher(joinPoint);
		const adviceMap = dispatchAdviceMap.get(dispatcher);
		if (type === AdviceType.Before) {
			(adviceMap.before || (adviceMap.before = [])).unshift(<BeforeAdvice> advice);
		}
		else {
			(adviceMap.after || (adviceMap.after = [])).push(advice);
		}
	}
	return dispatcher;
}

/**
 * Apply advice *before* the supplied joinPoint (function)
 *
 * @param joinPoint A function that should have advice applied to
 * @param advice The before advice
 */
export function before<F extends GenericFunction<any>>(joinPoint: F, advice: BeforeAdvice): F {
	return advise(joinPoint, AdviceType.Before, advice);
}

/**
 * Apply advice *after* the supplied joinPoint (function)
 *
 * @param joinPoint A function that should have advice applied to
 * @param advice The after advice
 */
export function after<F extends GenericFunction<T>, T>(joinPoint: F, advice: AfterAdvice<T>): F {
	return advise(joinPoint, AdviceType.After, advice);
}

/**
 * Apply advice *around* the supplied joinPoint (function)
 *
 * @param joinPoint A function that should have advice applied to
 * @param advice The around advice
 */
export function around<F extends GenericFunction<T>, T>(joinPoint: F, advice: AroundAdvice<T>): F {
	return advise<F, T>(joinPoint, AdviceType.Around, advice);
}
