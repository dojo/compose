import WeakMap from 'dojo-core/WeakMap';

export interface AdvisingFunction extends Function {
	next: AdvisingFunction;
	previous: AdvisingFunction;
}

export interface DispatchAdvice<T> {
	before?: BeforeAdvice[],
	after?: AfterAdvice<T>[],
	joinPoint: Function
}

export interface BeforeAdvice {
    (...args: any[]): any[] | void;
}

export interface AfterAdvice<T> {
    (result: T, ...args: any[]): T;
}

export interface AroundAdvice<T> {
    (origFn: GenericFunction<T>): (...args: any[]) => T;
}

export enum AdviceType { Before, After, Around };

const dispatchAdviceMap = new WeakMap<Function, DispatchAdvice<any>>();

export interface GenericFunction<T> {
	(...args: any[]): T;
}

function getDispatcher<T>(joinPoint: GenericFunction<T>): GenericFunction<T> {

	function dispatcher(...args: any[]): T {
		const adviceMap = dispatchAdviceMap.get(dispatcher);
		if (adviceMap.before) {
			args = adviceMap.before.reduce((previousArgs, advice) => {
				const currentArgs = advice.apply(this, previousArgs);
				return currentArgs ? currentArgs : previousArgs;
			}, args);
		}
		let result = adviceMap.joinPoint.apply(this, args);
		if (adviceMap.after) {
			result = adviceMap.after.reduce((previousResult, advice) => {
				return advice.apply(this, [ previousResult ].concat(args));
			}, result);
		}
		return result;
	}

	dispatchAdviceMap.set(dispatcher, {
		joinPoint: joinPoint
	});

	return dispatcher;
}

function advise<T>(joinPoint: GenericFunction<T>, type: AdviceType, advice: BeforeAdvice|AfterAdvice<T>|AroundAdvice<T>): GenericFunction<T> {
	let dispatcher: GenericFunction<any> = joinPoint;
	if (type === AdviceType.Around) {
		dispatcher = getDispatcher(advice.apply(this, [ joinPoint ]));
	}
	else {
		if (!dispatchAdviceMap.has(joinPoint)) {
			dispatcher = getDispatcher(joinPoint);
		}
		const adviceMap = dispatchAdviceMap.get(dispatcher);
		if (type === AdviceType.Before) {
			(adviceMap.before || (adviceMap.before = [])).unshift(<BeforeAdvice> advice);
		}
		else {
			(adviceMap.after || (adviceMap.after = [])).push(<AfterAdvice<T>> advice);
		}
	}
	return dispatcher;
}

export function before<T>(joinPoint: GenericFunction<T>, advice: BeforeAdvice): GenericFunction<T> {
	return advise(joinPoint, AdviceType.Before, advice);
}

export function after<T>(joinPoint: GenericFunction<T>, advice: AfterAdvice<T>): GenericFunction<T> {
	return advise(joinPoint, AdviceType.After, advice);
}

export function around<T>(joinPoint: GenericFunction<T>, advice: AroundAdvice<T>): GenericFunction<T> {
	return advise<T>(joinPoint, AdviceType.Around, advice);
}
