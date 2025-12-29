import {ErrorCast} from '@luolapeikko/core-ts-error';
import {Err, type IResult, Ok} from '@luolapeikko/result-option';
import {ClientError} from './ClientError';
import type {IStore} from './IStore';
import type {MemcachedRecord} from './MemcachedRecord';
import {ServerError} from './ServerError';

export type InMemoryStoreOptions = {
	maxRecords?: number;
	maxSizeMb?: number;
};

export class InMemoryStore implements IStore {
	public readonly name = 'InMemoryStore';
	#records: Map<string, MemcachedRecord>;
	#totalItems = 0;
	#maxRecords?: number;
	#maxSizeMb?: number;
	public constructor(records?: Map<string, MemcachedRecord>, options?: InMemoryStoreOptions) {
		this.#records = records || new Map();
		this.#maxRecords = options?.maxRecords;
		this.#maxSizeMb = options?.maxSizeMb;
	}

	public get size(): number {
		return this.#records.size;
	}

	public get totalItems(): number {
		return this.#totalItems;
	}

	public have(key: string): IResult<boolean, ClientError | ServerError> {
		return Ok(this.#records.has(key));
	}

	public get(key: string): IResult<MemcachedRecord | undefined, ClientError | ServerError> {
		const record = this.#records.get(key);
		if (!record || !record.isValid()) {
			return Ok(undefined);
		}
		return Ok(record);
	}

	public set(key: string, record: MemcachedRecord): IResult<void, ClientError | ServerError> {
		try {
			this.#records.set(key, record);
			this.#totalItems++;
			process.nextTick(() => this.purge());
			return Ok();
		} catch (cause) {
			return Err(new ServerError(ErrorCast.from(cause).message, {cause}));
		}
	}

	public delete(key: string): IResult<boolean, ClientError | ServerError> {
		try {
			if (!key) {
				return Err(new ClientError('bad command line format'));
			}
			return Ok(this.#records.delete(key));
		} catch (cause) {
			return Err(new ServerError(ErrorCast.from(cause).message, {cause}));
		}
	}

	public clear(): IResult<void, ClientError | ServerError> {
		this.#records.clear();
		this.#totalItems = 0;
		return Ok();
	}

	public purge() {
		// clear invalid records
		for (const [key, record] of this.#records) {
			if (!record.isValid()) {
				this.#records.delete(key);
				this.#totalItems--;
			}
		}
		// check if maxRecords is reached
		while (this.#maxRecords && this.#records.size > this.#maxRecords) {
			this.#records.delete(this.#records.keys().next().value);
			this.#totalItems--;
		}
		// check if maxSizeMb is reached
		if (this.#maxSizeMb) {
			let usageMb = process.memoryUsage().rss / 1024 / 1024;
			while (usageMb > this.#maxSizeMb) {
				this.#records.delete(this.#records.keys().next().value);
				this.#totalItems--;
				usageMb = process.memoryUsage().rss / 1024 / 1024;
			}
		}
	}
}
