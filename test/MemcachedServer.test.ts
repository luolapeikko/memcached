import {type ILoggerLike, LogLevel} from '@avanio/logger-like';
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {InMemoryStore} from '../src/InMemoryStore';
import type {MemcachedRecord} from '../src/MemcachedRecord';
import {MemcachedServer} from '../src/MemcachedServer';
import {MemcacheTestClient} from './lib/MemcacheTestClient';

const logSpy = vi.spyOn(console, 'log');

const logger = {
	debug: logSpy,
	info: logSpy,
	warn: logSpy,
	error: logSpy,
} satisfies ILoggerLike;
const records = new Map<string, MemcachedRecord>();

const server = new MemcachedServer({port: 11234, store: new InMemoryStore(records), logger});
server.logger.setLoggerLevel(LogLevel.Debug);
let client: MemcacheTestClient;

describe('MemcachedServer', () => {
	beforeEach(() => {
		logSpy.mockClear();
	});
	beforeAll(async () => {
		await server.start();
		client = new MemcacheTestClient('127.0.0.1:11234');
	});
	describe('set', () => {
		it('should set a buffer value', async () => {
			await client.set('test_buffer', Buffer.from('value'), 0);
			expect(logSpy.mock.calls[0][0]).toBe('Client connected to server'); // only on first test
			expect(logSpy.mock.calls[1][0]).toBe('set: test_buffer');
			expect(logSpy.mock.calls.length).toBe(2);
		});
		it('should set a string value', async () => {
			await client.set('test_string1', 'value', 0);
			await client.set('test_string2', 'value', 0);
			expect(logSpy.mock.calls[0][0]).toBe('set: test_string1');
			expect(logSpy.mock.calls[1][0]).toBe('set: test_string2');
			expect(logSpy.mock.calls.length).toBe(2);
		});
		it('should not get purged value', async () => {
			await client.set('test_stringp', 'value', -1);
			const data = await client.get('test_stringp');
			expect(data).toBe(undefined);
			expect(logSpy.mock.calls[0][0]).toBe('set: test_stringp');
			expect(logSpy.mock.calls[1][0]).toBe('get: test_stringp');
			expect(logSpy.mock.calls.length).toBe(2);
		});
	});
	describe('touch', () => {
		it('should touch a existing string value', async () => {
			await client.touch('test_string1', 0);
			expect(logSpy.mock.calls[0][0]).toBe('touch: test_string1');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('get', () => {
		it('should get a buffer value', async () => {
			const data = await client.get('test_buffer');
			expect(data).to.be.eql(Buffer.from('value'));
			expect(logSpy.mock.calls[0][0]).toBe('get: test_buffer');
			expect(logSpy.mock.calls.length).toBe(1);
		});
		it('should get a string value', async () => {
			const data = await client.get('test_string1');
			expect(data).toBe('value');
			expect(logSpy.mock.calls[0][0]).toBe('get: test_string1');
			expect(logSpy.mock.calls.length).toBe(1);
		});
		it('should get multiple string values', async () => {
			const data = await client.getMulti(['test_string1', 'test_string2']);
			expect(data).to.be.eql({test_string1: 'value', test_string2: 'value'});
			expect(logSpy.mock.calls[0][0]).toBe('get: test_string1, test_string2');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('gets', () => {
		it('should get a string value', async () => {
			const data = await client.gets('test_string1');
			expect(data).to.be.an('object');
			expect(data.cas).to.be.a('string');
			expect(data.test_string1).to.be.a('string');
			expect(logSpy.mock.calls[0][0]).toBe('gets: test_string1');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('cas', () => {
		it('should cas', async () => {
			const data = await client.gets('test_string1');
			await expect(client.cas('test_string1', 'value', data.cas, 0)).resolves.toBe(true);
			expect(logSpy.mock.calls[0][0]).toBe('gets: test_string1');
			expect(logSpy.mock.calls[1][0]).toBe('cas: test_string1');
			expect(logSpy.mock.calls.length).toBe(2);
		});
	});
	describe('replace', () => {
		it('should replace a existing string value', async () => {
			await expect(client.replace('test_string1', 'value2', 0)).resolves.toBe(true);
			await expect(client.get('test_string1')).resolves.toBe('value2');
			expect(logSpy.mock.calls[0][0]).toBe('replace: test_string1');
			expect(logSpy.mock.calls[1][0]).toBe('get: test_string1');
			expect(logSpy.mock.calls.length).toBe(2);
		});
		it('should not replace a non existing string value', async () => {
			await expect(client.replace('test_string3', 'value2', 0)).resolves.toBe(false);
			expect(logSpy.mock.calls[0][0]).toBe('replace: test_string3');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('add', () => {
		it('should add a string value', async () => {
			await expect(client.add('test_string3', 'value', 0)).resolves.toBe(true);
			await expect(client.get('test_string3')).resolves.toBe('value');
			await expect(client.del('test_string3')).resolves.toBe(true);
			expect(logSpy.mock.calls[0][0]).toBe('add: test_string3');
			expect(logSpy.mock.calls[1][0]).toBe('get: test_string3');
			expect(logSpy.mock.calls[2][0]).toBe('delete: test_string3');
			expect(logSpy.mock.calls.length).toBe(3);
		});
		it('should not add a existing string value', async () => {
			await expect(client.add('test_string1', 'value2', 0)).resolves.toBe(false);
			expect(logSpy.mock.calls[0][0]).toBe('add: test_string1');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('append', () => {
		it('should append a string value', async () => {
			await expect(client.append('test_string1', 'append')).resolves.toBe(true);
			await expect(client.get('test_string1')).resolves.toBe('value2append');
			expect(logSpy.mock.calls[0][0]).toBe('append: test_string1');
			expect(logSpy.mock.calls[1][0]).toBe('get: test_string1');
			expect(logSpy.mock.calls.length).toBe(2);
		});
		it('should not append a non existing string value', async () => {
			await expect(client.append('test_string3', 'value2')).resolves.toBe(false);
			expect(logSpy.mock.calls[0][0]).toBe('append: test_string3');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('prepend', () => {
		it('should prepend a string value', async () => {
			await expect(client.prepend('test_string1', 'prepend')).resolves.toBe(true);
			await expect(client.get('test_string1')).resolves.toBe('prependvalue2append');
			expect(logSpy.mock.calls[0][0]).toBe('prepend: test_string1');
			expect(logSpy.mock.calls[1][0]).toBe('get: test_string1');
			expect(logSpy.mock.calls.length).toBe(2);
		});
		it('should not prepend a non existing string value', async () => {
			await expect(client.prepend('test_string3', 'value2')).resolves.toBe(false);
			expect(logSpy.mock.calls[0][0]).toBe('prepend: test_string3');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('incr', () => {
		it('should increment a string value', async () => {
			await expect(client.set('test_incr', 0, 0)).resolves.toBe(true);
			await expect(client.incr('test_incr', 1)).resolves.toBe(1);
			expect(logSpy.mock.calls[0][0]).toBe('set: test_incr');
			expect(logSpy.mock.calls[1][0]).toBe('incr: test_incr');
			expect(logSpy.mock.calls.length).toBe(2);
		});
		it('should not increment a non existing string value', async () => {
			await expect(client.incr('not_test_incr', 1)).resolves.toBe(false);
			expect(logSpy.mock.calls[0][0]).toBe('incr: not_test_incr');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('decr', () => {
		it('should decrement a string value', async () => {
			await expect(client.set('test_decr', 1, 0)).resolves.toBe(true);
			await expect(client.decr('test_decr', 1)).resolves.toBe(0);
			expect(logSpy.mock.calls[0][0]).toBe('set: test_decr');
			expect(logSpy.mock.calls[1][0]).toBe('decr: test_decr');
			expect(logSpy.mock.calls.length).toBe(2);
		});
		it('should not decrement a non existing string value', async () => {
			await expect(client.decr('not_test_decr', 1)).resolves.toBe(false);
			expect(logSpy.mock.calls[0][0]).toBe('decr: not_test_decr');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('stats', () => {
		it('should get stats', async () => {
			const stats = await client.stats();
			expect(stats).to.be.an('array');
			expect(Object.keys(stats[0])).to.be.eql([
				'server',
				'pid',
				'uptime',
				'time',
				'version',
				'curr_items',
				'total_items',
				'bytes',
				'max_bytes',
				'tcpport',
				'num_threads',
				'cas_enabled',
				'evictions',
			]);
			expect(logSpy.mock.calls[0][0]).toBe('stats');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});
	describe('flush', () => {
		it('should flush', async () => {
			await expect(client.flush()).resolves.toBe(undefined);
			expect(logSpy.mock.calls[0][0]).toBe('flush_all');
			expect(logSpy.mock.calls.length).toBe(1);
		});
	});

	afterAll(async () => {
		client?.end();
		await server.stop();
	});
});
