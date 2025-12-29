import Memcached from 'memcached';

function getFirst<T>(array: T | T[]): T {
	return Array.isArray(array) ? array[0] : array;
}

export class MemcacheTestClient {
	private client: Memcached;

	constructor(server: string, options?: Memcached.options) {
		this.client = new Memcached(server, options);
	}

	public get(key: string): Promise<any> {
		return new Promise((resolve, reject) => {
			this.client.get(key, (err, data) => {
				if (err) {
					return reject(err);
				}
				resolve(data);
			});
		});
	}

	public gets(key: string): Promise<{
		[key: string]: any;
		cas: string;
	}> {
		return new Promise((resolve, reject) => {
			this.client.gets(key, (err, data) => {
				if (err) {
					return reject(getFirst(err));
				}
				resolve(data);
			});
		});
	}

	public getMulti(keys: string[]): Promise<{[key: string]: any}> {
		return new Promise((resolve, reject) => {
			this.client.getMulti(keys, (err, data) => {
				if (err) {
					return reject(err);
				}
				resolve(data);
			});
		});
	}

	public set(key: string, value: any, lifetime: number): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.set(key, value, lifetime, (err, result) => {
				if (err) {
					if ((err as any).notStored) {
						return resolve(false);
					}
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public add(key: string, value: any, lifetime: number): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.add(key, value, lifetime, (err, result) => {
				if (err) {
					if ((err as any).notStored) {
						return resolve(false);
					}
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public replace(key: string, value: any, lifetime: number): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.replace(key, value, lifetime, (err, result) => {
				if (err) {
					if ((err as any).notStored) {
						return resolve(false);
					}
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public append(key: string, value: any): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.append(key, value, (err, result) => {
				if (err) {
					if ((err as any).notStored) {
						return resolve(false);
					}
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public prepend(key: string, value: any): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.prepend(key, value, (err, result) => {
				if (err) {
					if ((err as any).notStored) {
						return resolve(false);
					}
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public cas(key: string, value: any, cas: string, lifetime: number): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.cas(key, value, cas, lifetime, (err, result) => {
				if (err) {
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public del(key: string): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.del(key, (err, result) => {
				if (err) {
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public incr(key: string, amount: number): Promise<number | boolean> {
		return new Promise((resolve, reject) => {
			this.client.incr(key, amount, (err, result) => {
				if (err) {
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public decr(key: string, amount: number): Promise<number | boolean> {
		return new Promise((resolve, reject) => {
			this.client.decr(key, amount, (err, result) => {
				if (err) {
					return reject(err);
				}
				resolve(result);
			});
		});
	}

	public touch(key: string, lifetime: number): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.touch(key, lifetime, (err) => {
				if (err) {
					return reject(err);
				}
				resolve(true);
			});
		});
	}

	public stats(): Promise<Memcached.StatusData[]> {
		return new Promise((resolve, reject) => {
			this.client.stats((err, data) => {
				if (err) {
					return reject(err);
				}
				resolve(data);
			});
		});
	}

	public flush(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.client.flush((err) => {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	}

	public version(): Promise<Memcached.VersionData[]> {
		return new Promise((resolve, reject) => {
			this.client.version((err, data) => {
				if (err) {
					return reject(err);
				}
				resolve(data);
			});
		});
	}

	public end(): void {
		this.client.end();
	}
}
