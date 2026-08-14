#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {InMemoryStore, MemcachedServer} from './dist/index.mjs';

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

main();
