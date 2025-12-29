import type {IResult} from '@luolapeikko/result-option';
import type {ClientError} from './ClientError';
import type {MemcachedRecord} from './MemcachedRecord';
import type {ServerError} from './ServerError';

export interface IStore {
	name: string;
	size: number;
	totalItems: number;
	have(key: string): IResult<boolean, ClientError | ServerError>;
	get(key: string): IResult<MemcachedRecord | undefined, ClientError | ServerError>;
	set(key: string, record: MemcachedRecord): IResult<void, ClientError | ServerError>;
	delete(key: string): IResult<boolean, ClientError | ServerError>;
	clear(): IResult<void, ClientError | ServerError>;
}
