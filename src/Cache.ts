import { LinkedList } from "./LinkedList";

type ParamState = string | number | boolean | null;

interface EntryState {
  paramHash: string;
  paramState: ParamState;
  cache: Promise<any>;
  isBeingUsed: boolean;
  isResolved: boolean;
}

export interface CacheSettings<Param, Result> {
  /**
   * Called one per cached function call. It should a digest of the param that
   * uniquely identifies a cache entry. If the param produces the same hash as
   * a cached previous call's, that call's promised result will be returned and
   * the wrapped function is not invoked.
   */
  paramHasher: (param: Param) => string;

  /**
   * Called once per cached function call. Obtains a state representation of
   * the call based on the param. If the state changes from the previous call
   * with same param hash, the previous cache is invalidated.
   */
  paramState: (param: Param) => ParamState;

  /**
   * Specifies the max number of cache entries (as identified by the unique
   * param hash) that should be retained.
   */
  maxEntries: number;

  /**
   * Returns true if the result should be cached. By default every result
   * is cached.
   */
  shouldCache?: (result: Result, param: Param) => boolean;
}

/**
 * Creates a version of the input function that cached its calls based
 * on the specified cache settings.
 *
 * @param fn The function whose calls are to be cached by parameter hashing.
 * @param cacheSettings Specifies how the caching should behave.
 */
export function withCache<Param, Return>(
  fn: (param: Param) => Promise<Return>,
  cacheSettings: CacheSettings<Param, Return>
): ((param: Param) => Promise<Return>) & {
  _entriesByAccess: LinkedList<EntryState>;
} {
  const entriesByHash = new Map<String, EntryState>();
  const entriesByAccess = new LinkedList<EntryState>();

  function invoke(entryState: EntryState, param: Param, paramHash: string) {
    entryState.isBeingUsed = true;
    entryState.isResolved = false;
    try {
      const promise = (entryState.cache = fn(param)
        .then(result => {
          if (entryState.cache === promise) {
            entryState.isResolved = true;
            const { shouldCache } = cacheSettings;
            if (shouldCache && !shouldCache(result, param)) {
              detach(entryState);
            }
            return result;
          }
        })
        .catch(error => {
          if (entryState.cache === promise) {
            detach(entryState);
          }
          throw error;
        }));
      entryState.isBeingUsed = false;
    } catch (error) {
      detach(entryState);
      throw error;
    }
  }

  function detach(entryState: EntryState) {
    entriesByAccess.remove(entryState);
    entriesByHash.delete(entryState.paramHash);
  }

  return Object.assign(
    (param: Param): Promise<Return> => {
      const paramHash = cacheSettings.paramHasher(param);
      const callState = cacheSettings.paramState(param);
      const entryState = entriesByHash.get(paramHash);
      if (entryState) {
        if (entryState.isBeingUsed) {
          console.error(
            "Recursion on exactly the same cached computation detected.",
            param
          );
          throw Error(
            "Recursion on exactly the same cached computation detected."
          );
        }

        const isCacheUseable =
          compareCallState(callState, entryState.paramState) &&
          entryState.isResolved;

        if (!isCacheUseable) {
          entryState.paramState = callState;
          invoke(entryState, param, paramHash);
        }
        entriesByAccess.insertAtHead(entryState);
        return entryState.cache;
      } else {
        const entryState: EntryState = {
          paramState: callState,
          paramHash: paramHash,
          isBeingUsed: true,
          isResolved: false,
          cache: null as any
        };
        entriesByAccess.insertAtHead(entryState);
        entriesByHash.set(paramHash, entryState);
        invoke(entryState, param, paramHash);
        if (entriesByAccess.length > cacheSettings.maxEntries) {
          const tail = entriesByAccess.tail;
          if (tail) {
            entriesByAccess.remove(tail);
            entriesByHash.delete(tail.paramHash);
          }
        }
        return entryState.cache;
      }
    },
    { _entriesByAccess: entriesByAccess }
  );
}

function compareCallState(a: ParamState, b: ParamState) {
  return a === b;
}
