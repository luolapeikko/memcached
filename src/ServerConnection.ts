import type * as net from 'node:net';
import {type LevelLogger, LogLevel} from '@avanio/logger-like';
import {ErrorCast} from '@luolapeikko/core-ts-error';
import {Err, type IResult, Ok} from '@luolapeikko/result-option';
import {ClientError} from './ClientError';
import type {IStore} from './IStore';
import {MemcachedRecord} from './MemcachedRecord';
import {ServerCore} from './ServerCore';
import {ServerError} from './ServerError';
import {TcpResponse} from './TcpResponse';

const ERROR_BUFFER = Buffer.from('ERROR\r\n');

type ServerSocketConnectionOptions = {
	store: IStore;
	logger: LevelLogger;
	delay?: boolean;
	fast?: boolean;
};

/**
 * A connection to the server.
 */
export class ServerSocketConnection {
	private options: ServerSocketConnectionOptions;
	#logger: LevelLogger;
	private socket: net.Socket | null;
	public weight = 1;

	constructor(options: ServerSocketConnectionOptions) {
		this.options = options;
		this.#logger = options.logger;
		this.socket = null;
	}

	init(socket: net.Socket) {
		this.socket = socket;
		this.#logger?.info('Client connected to server');
		if (!this.options.delay) {
			socket.setNoDelay();
		}
		socket.on('end', () => {
			this.#logger?.info('Client disconnected from server');
		});
		socket.on('error', (error) => {
			this.#logger?.info('Socket error: %s', error);
			socket.end();
		});
		socket.on('data', (data) => this.readData(data));
	}

	readData(data: Buffer | string) {
		// EOT (control-D)
		if (data[0] === 4) {
			return this.socket?.end();
		}
		if (this.options.fast) {
			return this.socket?.write(ERROR_BUFFER);
		}
		const {line, rest} = this.#parseLine(data as Buffer);
		if (line.startsWith('quit')) {
			this.#logger?.info('Quitting');
			return this.socket?.end();
		}
		const output = this.processCommands(line, rest);
		if (output) {
			this.socket?.write(output);
		}
	}

	private processCommands(line: string, data?: string): string | undefined {
		// noReply only for storage commands (set, add, replace, append, prepend, cas)
		const noReply = line.includes('noreply');
		const words = line.trim().split(/\s+/);
		const command = words.shift();
		try {
			switch (command) {
				case 'version':
					this.#logger.debug(`version: ${ServerCore.getVersion()}`);
					return this.#handleVersion();
				case 'stats':
					this.#logger.debug(`stats`);
					return this.#handleStats();
				case 'flush_all': {
					this.#logger.debug(`flush_all`);
					this.options.store.clear();
					return TcpResponse.OK;
				}
				case 'verbosity': {
					this.#logger.debug(`verbosity: ${words[0]}`);
					switch (words[0]) {
						case '0':
							this.#logger.setLoggerLevel(LogLevel.None);
							break;
						case '1':
							this.#logger.setLoggerLevel(LogLevel.Debug);
							break;
						case '2':
							this.#logger.setLoggerLevel(LogLevel.Info);
							break;
						case '3':
							this.#logger.setLoggerLevel(LogLevel.Warn);
							break;
						case '4':
							this.#logger.setLoggerLevel(LogLevel.Error);
							break;
					}
					return TcpResponse.OK;
				}
				case 'delete': {
					this.#logger.debug(`delete: ${words[0]}`);
					const isDeleted = this.options.store.delete(words[0]).unwrap();
					if (noReply) {
						return undefined;
					}
					return isDeleted ? TcpResponse.DELETED : TcpResponse.NOT_FOUND;
				}
				case 'set': {
					this.#logger.debug(`set: ${words[0]}`);
					const [key, record] = this.#buildRecord(words, data).unwrap();
					this.options.store.set(key, record).unwrap();
					if (noReply) {
						return undefined;
					}
					return TcpResponse.STORED;
				}
				case 'cas': {
					this.#logger.debug(`cas: ${words[0]}`);
					const [key, record] = this.#buildRecord(words, data).unwrap();
					if (typeof words[4] !== 'string') {
						return TcpResponse.createClientError('bad command line format');
					}
					const existing = this.options.store.get(key).unwrap();
					if (!existing) {
						return noReply ? undefined : TcpResponse.NOT_FOUND;
					}
					if (existing.cas !== words[4]) {
						return noReply ? undefined : TcpResponse.EXISTS;
					}
					this.options.store.set(key, record).unwrap();
					return noReply ? undefined : TcpResponse.STORED;
				}
				case 'replace': {
					this.#logger.debug(`replace: ${words[0]}`);
					const [key, record] = this.#buildRecord(words, data).unwrap();
					if (!this.options.store.have(key).ok()) {
						return noReply ? undefined : TcpResponse.NOT_STORED;
					}
					this.options.store.set(key, record).unwrap();
					return noReply ? undefined : TcpResponse.STORED;
				}
				case 'add': {
					this.#logger.debug(`add: ${words[0]}`);
					const [key, record] = this.#buildRecord(words, data).unwrap();
					if (this.options.store.have(key).ok()) {
						return noReply ? undefined : TcpResponse.NOT_STORED;
					}
					this.options.store.set(key, record).unwrap();
					return noReply ? undefined : TcpResponse.STORED;
				}
				case 'touch': {
					this.#logger.debug(`touch: ${words[0]}`);
					const record = this.options.store.get(words[0]).unwrap();
					if (!record) {
						return noReply ? undefined : TcpResponse.NOT_FOUND;
					}
					record.touch(this.#parseClientInt(words[1]));
					this.options.store.set(words[0], record).unwrap();
					return noReply ? undefined : TcpResponse.TOUCHED;
				}
				case 'get': {
					this.#logger.debug(`get: ${words.join(', ')}`);
					const results: string[] = [];
					for (const key of words) {
						const record = this.options.store.get(key).unwrap();
						if (record) {
							const value = typeof record.value === 'string' ? record.value : JSON.stringify(record.value);
							results.push(`VALUE ${key} ${record.flags} ${value.length}\r\n${value}\r\n`);
						}
					}
					return `${results.join('')}${TcpResponse.END}`;
				}
				case 'gets': {
					this.#logger.debug(`gets: ${words[0]}`);
					const results: string[] = [];
					for (const key of words) {
						const record = this.options.store.get(key).unwrap();
						if (record) {
							const value = typeof record.value === 'string' ? record.value : JSON.stringify(record.value);
							results.push(`VALUE ${key} ${record.flags} ${value.length} ${record.cas}\r\n${value}\r\n`);
						}
					}
					return `${results.join('')}${TcpResponse.END}`;
				}
				case 'incr': {
					this.#logger.debug(`incr: ${words[0]}`);
					const record = this.options.store.get(words[0]).unwrap();
					if (!record) {
						return TcpResponse.NOT_FOUND;
					}
					record.value = this.#parseClientInt(record.value) + this.#parseClientInt(words[1]);
					this.options.store.set(words[0], record).unwrap();
					return `${record.value}\r\n`;
				}
				case 'decr': {
					this.#logger.debug(`decr: ${words[0]}`);
					const record = this.options.store.get(words[0]).unwrap();
					if (!record) {
						return TcpResponse.NOT_FOUND;
					}
					record.value = this.#parseClientInt(record.value) - this.#parseClientInt(words[1]);
					if ((record.value as number) < 0) {
						record.value = 0;
					}
					this.options.store.set(words[0], record).unwrap();
					return `${record.value}\r\n`;
				}
				case 'append': {
					this.#logger.debug(`append: ${words[0]}`);
					const record = this.options.store.get(words[0]).unwrap();
					if (!record) {
						return noReply ? undefined : TcpResponse.NOT_FOUND;
					}
					if (!data) {
						return noReply ? undefined : TcpResponse.createClientError('bad command line format');
					}
					const stringValue = typeof record.value === 'string' ? record.value : JSON.stringify(record.value);
					record.value = stringValue + data;
					this.options.store.set(words[0], record).unwrap();
					return noReply ? undefined : TcpResponse.STORED;
				}
				case 'prepend': {
					this.#logger.debug(`prepend: ${words[0]}`);
					const record = this.options.store.get(words[0]).unwrap();
					if (!record) {
						return noReply ? undefined : TcpResponse.NOT_FOUND;
					}
					if (!data) {
						return noReply ? undefined : TcpResponse.createClientError('bad command line format');
					}
					const stringValue = typeof record.value === 'string' ? record.value : JSON.stringify(record.value);
					record.value = data + stringValue;
					this.options.store.set(words[0], record).unwrap();
					return noReply ? undefined : TcpResponse.STORED;
				}
				default: {
					this.#logger.debug(`unknown command: ${command}`);
					return TcpResponse.createServerError(`unknown command: ${command}`);
				}
			}
		} catch (cause) {
			if (cause instanceof ClientError || cause instanceof ServerError) {
				return cause.toTcpString();
			}
			return new ServerError(ErrorCast.from(cause).message, {cause}).toTcpString();
		}
	}

	#buildRecord([key, flags, exptime, _bytes]: string[], data?: string): IResult<[key: string, MemcachedRecord], ClientError> {
		try {
			if (!data || !key) {
				return Err(new ClientError('bad command line format'));
			}
			// ensure no trailing \r\n
			const value = data.endsWith('\r\n') ? data.slice(0, -2) : data;
			return Ok([key, new MemcachedRecord(value, parseInt(exptime, 10), parseInt(flags, 10))]);
		} catch (error) {
			return Err(new ClientError(error.message));
		}
	}

	#handleVersion() {
		return `VERSION ${ServerCore.getVersion()}\r\n`;
	}

	#handleStats() {
		const stats = {
			pid: process.pid,
			uptime: process.uptime(),
			time: Math.floor(Date.now() / 1000),
			version: ServerCore.getVersion(),
			curr_items: this.options.store.size,
			total_items: this.options.store.totalItems,
			bytes: process.memoryUsage().rss,
			max_bytes: 0,
			tcpport: 0,
			num_threads: 1,
			cas_enabled: 'no',
			evictions: 'on',
		};
		let output = '';
		for (const [key, value] of Object.entries(stats)) {
			output += `STAT ${key} ${value}\r\n`;
		}
		return `${output}${TcpResponse.END}`;
	}

	/*
	 * Parse a line. Equivalent to:
	 * const message = data.toString();
	 * const line = message.substringUpTo('\r\n');
	 * const rest = message.substringFrom('\r\n');
	 */
	#parseLine(data: Buffer): {line: string; rest?: string} {
		const lineBreak = data.indexOf('\r\n');
		if (lineBreak < data.length - 2) {
			return {
				line: data.toString('utf8', 0, lineBreak),
				rest: data.toString('utf8', lineBreak + 2, data.length - 2),
			};
		}
		return {line: data.toString('utf8', 0, data.length - 2)};
	}

	#parseClientInt(value: unknown): number {
		if (typeof value === 'number') {
			return value;
		}
		if (typeof value !== 'string') {
			throw new ClientError('Invalid integer value');
		}
		const out = parseInt(value, 10);
		if (Number.isNaN(out)) {
			throw new ClientError('Invalid integer value');
		}
		return out;
	}
}
