# TypeScript First: Simple Cache Wrapper

Allow an async function' calls to be cached and have its cached invalidated
in an unopinionated, declarative manner. The intention is to save repeated
reads over network partitions such as sending `GET` requests on the client side
or querying database reads from the server side.

## Installation

```
npm install @typescript-first/simple-cache
```

## Usage

Suppse we have a function `expensiveUpperCase`. Upper-casing isn't really expensive,
we'll artifically make it so.

```ts
async function expensiveUpperCase(input: string) {
  await new Promise(resolve => setTimeout(resolve, 5000));
  return input.toUpperCase();
}
```

We can produce the cached version of the function like this:

```ts
import { withCache } from "@typescript-first/simple-cache";
const cachedExpensiveUpperCase = withCache(expensiveUpperCase, {
  paramHasher: (input: string) => string,
  paramState: (input: string) => null,
  maxEntries: 10
});
```

In general:

```ts
withCache(inputFunction, cacheSettings);
```

In the `cacheSettings` object:

- You provide a `paramHasher` to produce a string that is used to look up a
  cache entry based on your function's input argument value. So this should
  be unique for each possible argument value.
- You provide a `paramState` to associate a state to a cache entry. When the
  state changes on a subsequent call, the previous cached value is
  invalidated. In the example above, our computation is stateless so we just
  statically return a constant `null` -- the constant outcome means that the
  cache will be perpetually valid.
- You provide how many cache entries to retain. Cache entries least recently
  used will be kicked out once the limit is exceeded.

The cached version of the function has exactly the same signature as the input
function.

```ts
cacheExpensiveUpperCace("hello");
```

## Current limitations

The input function must be `async` and must accept only one parameter.
