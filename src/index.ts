#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {InMemoryStore} from './InMemoryStore';
import {MemcachedServer} from './MemcachedServer';

export * from './ClientError';
export * from './InMemoryStore';
export * from './IStore';
export * from './MemcachedRecord';
export * from './MemcachedServer';
export * from './ServerConnection';
export * from './ServerCore';
export * from './ServerError';
export * from './TcpResponse';

/**
 * CLI Entry point
 */
async function main() {
	const {values} = parseArgs({
		options: {
			port: {
				type: 'string',
				short: 'p',
			},
			logger: {
				type: 'boolean',
				short: 'l',
			},
		},
		strict: false, // Allow other args without throwing
	});
	const port = typeof values.port === 'string' ? parseInt(values.port, 10) : undefined;
	const haveLogger = !(values.logger === 'false' || values.logger === false);
	const server = new MemcachedServer({port, store: new InMemoryStore(), logger: haveLogger ? console : undefined});
	try {
		await server.start();
	} catch (error) {
		console.error(`Error: Failed to start server on port ${port}`);
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

// Check if we are running as a CLI
const isCli = process.argv[1]?.endsWith('index.cjs') || process.argv[1]?.endsWith('index.mjs') || process.argv[1]?.endsWith('index.ts');
if (isCli) {
	main().catch((err) => {
		console.error('Unhandled error in main:', err);
		process.exit(1);
	});
}
