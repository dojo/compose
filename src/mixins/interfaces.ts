/**
 * We have copied the interfaces from RxJS that we are dependent upon in order to decouple the need
 * to install RxJS to consume this package.  These were derived from @reactivex/rxjs@5.0.0-beta.6.
 *
 * Hopefully these will mirror what eventually becomes the ES Observable interfaces and will become
 * part of a standard library.
 */

export interface NextObserver<T> {
	isUnsubscribed?: boolean;
	next: (value: T) => void;
	error?: (err: any) => void;
	complete?: () => void;
}

export interface ErrorObserver<T> {
	isUnsubscribed?: boolean;
	next?: (value: T) => void;
	error: (err: any) => void;
	complete?: () => void;
}
export interface CompletionObserver<T> {
	isUnsubscribed?: boolean;
	next?: (value: T) => void;
	error?: (err: any) => void;
	complete: () => void;
}

export type PartialObserver<T> = NextObserver<T> | ErrorObserver<T> | CompletionObserver<T>;

export interface Observable<T> {
	/**
	 * Registers handlers for handling emitted values, error and completions from the observable, and
	 *  executes the observable's subscriber function, which will take action to set up the underlying data stream
	 * @method subscribe
	 * @param {PartialObserver|Function} observerOrNext (optional) either an observer defining all functions to be called,
	 *  or the first of three possible handlers, which is the handler for each value emitted from the observable.
	 * @param {Function} error (optional) a handler for a terminal event resulting from an error. If no error handler is provided,
	 *  the error will be thrown as unhandled
	 * @param {Function} complete (optional) a handler for a terminal event resulting from successful completion.
	 * @return {ISubscription} a subscription reference to the registered handlers
	 */
	subscribe(observerOrNext?: PartialObserver<T> | ((value: T) => void), error?: (error: any) => void, complete?: () => void): Subscription;
}

export interface AnonymousSubscription {
	unsubscribe(): void;
}

export type TeardownLogic = AnonymousSubscription | Function | void;

export interface Subscription extends AnonymousSubscription {
	unsubscribe(): void;
	isUnsubscribed: boolean;
	add(teardown: TeardownLogic): Subscription;
	remove(sub: Subscription): void;
}
