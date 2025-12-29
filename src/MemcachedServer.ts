import * as net from 'node:net';
import {type ILoggerLike, LevelLogger, LogLevel} from '@avanio/logger-like';
import {Err, type IResult, Ok} from '@luolapeikko/result-option';
import type {IStore} from './IStore';
import {ServerSocketConnection} from './ServerConnection';

// constants
const DEFAULT_PORT = 11211;

export type ServerConnectionOptions = {
	store: IStore;
	logger?: ILoggerLike;
	port?: number;
};

/**
 */
export class MemcachedServer {
	#socketServer: net.Server | undefined;
	#options: ServerConnectionOptions;
	public readonly logger: LevelLogger;

	constructor(options: ServerConnectionOptions) {
		this.#options = options;
		this.logger = new LevelLogger(options.logger);
		this.logger.setLoggerLevel(LogLevel.Info);
	}

	/*
	 * Start the server. Options:
	 *	- port: to listen on.
	 *	- fast: return 'ERROR' on every query.
	 *	- notice: show notice messages.
	 *	- info: show info messages.
	 *	- debug: show debug messages.
	 * An optional callback will be called after the server has started.
	 */
	async start(): Promise<void> {
		const port = this.#options.port || DEFAULT_PORT;
		this.#socketServer = (await this.#createSocketServer(port))
			.inspectOk(() => this.logger.info(`MemcachedServer started on port: ${port}, store: ${this.#options.store.name}`))
			.unwrap();
	}

	async stop(): Promise<void> {
		return (await this.#closeSocketServer(this.#socketServer)).inspectOk(() => this.logger.info('MemcachedServer stopped')).unwrap();
	}

	#createSocketServer(port: number): Promise<IResult<net.Server, Error>> {
		return new Promise((resolve, reject) => {
			const server = net.createServer((socket) => {
				new ServerSocketConnection({...this.#options, logger: this.logger}).init(socket);
			});
			server.once('error', (cause) => reject(Err(new Error(`MemcachedServer error: ${cause.message}`, {cause}))));
			server.listen(port, () => resolve(Ok(server)));
		});
	}

	#closeSocketServer(server?: net.Server): Promise<IResult<void, Error>> {
		if (!server) return Promise.resolve(Ok());
		return new Promise((resolve, reject) => {
			server.close((cause) => {
				if (cause) return reject(Err(new Error(`MemcachedServer error: ${cause.message}`, {cause})));
				return resolve(Ok());
			});
		});
	}
}
