import type {ILoggerLike} from '@avanio/logger-like';

const MAX_RELATIVE_SECONDS = 60 * 60 * 24 * 30;

/* <cas unique> is a unique 64-bit value of an existing entry.
  Clients should use the value returned from the "gets" command
  when issuing "cas" updates. */
let casCounter = BigInt(Date.now()) * 1000n;

/**
 * A record to store in memory. Params:
 *	- value: the value to store.
 *	- expirationSeconds: the number of seconds that the item must live, at most.
 *	- flags: to store with the value.
 */
export class MemcachedRecord {
	public flags: number;
	public expiration: number;
	public value: unknown;
	#logger?: ILoggerLike;
	#cas: string;

	constructor(value: unknown, expirationSeconds: number, flags: number, logger?: ILoggerLike) {
		this.#logger = logger;
		this.flags = flags;
		this.expiration = 0;
		this.value = value;
		this.#cas = (casCounter++).toString();
		if (expirationSeconds) {
			if (expirationSeconds < MAX_RELATIVE_SECONDS) {
				this.expiration = Date.now() + 1000 * expirationSeconds;
			} else {
				this.expiration = 1000 * expirationSeconds;
			}
		}
	}

	public get cas() {
		return this.#cas;
	}

	touch(expirationSeconds: number) {
		if (expirationSeconds) {
			if (expirationSeconds < MAX_RELATIVE_SECONDS) {
				this.expiration = Date.now() + 1000 * expirationSeconds;
			} else {
				this.expiration = 1000 * expirationSeconds;
			}
		} else {
			this.expiration = 0;
		}
		this.#cas = (casCounter++).toString();
	}

	/**
	 * Find out if the record is still valid.
	 */
	isValid(): boolean {
		if (!this.expiration) {
			return true;
		}
		this.#logger?.debug('Now: %s, expiration: %s', Date.now(), this.expiration);
		return Date.now() < this.expiration;
	}
}
