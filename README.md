# @luolapeikko/memcached

Javascript memcached server (loosley based on https://github.com/alexfernandez/nodecached).
This is quite minimalistic implementation, but it should be enough for simple use cases and unit testing.
Currently only supports TCP protocol and have only in-memory storage.

## Usage

### CLI

```bash
npm install -g @luolapeikko/memcached
memcached
```

### API

```typescript
import { MemcachedServer } from "@luolapeikko/memcached";

const server = new MemcachedServer({
  port: 11211,
  store: new InMemoryStore(),
  logger: console,
});
await server.start();

await server.stop();
```
