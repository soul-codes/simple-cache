import { LinkedList } from "./LinkedList";

type ParamState = string | number | boolean | null;

interface EntryState {
  paramHash: string;
  paramState: ParamState;
  cache: Promise<any>;
  isBeingUsed: boolean;
}

export interface CacheSettings<Param> {
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
  cacheSettings: CacheSettings<Param>
): ((param: Param) => Promise<Return>) & {
  _entriesByAccess: LinkedList<EntryState>;
} {
  const entriesByHash = new Map<String, EntryState>();
  const entriesByAccess = new LinkedList<EntryState>();

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

        if (!compareCallState(callState, entryState.paramState)) {
          entryState.isBeingUsed = true;
          try {
            entryState.cache = fn(param);
          } catch (error) {
            entriesByAccess.remove(entryState);
            entriesByHash.delete(paramHash);
            throw error;
          }
          entryState.paramState = callState;
          entryState.isBeingUsed = false;
        }
        entriesByAccess.insertAtHead(entryState);
        return entryState.cache;
      } else {
        const entryState: EntryState = {
          paramState: callState,
          paramHash: paramHash,
          isBeingUsed: true,
          cache: null as any
        };
        entriesByAccess.insertAtHead(entryState);
        entriesByHash.set(paramHash, entryState);

        try {
          entryState.cache = fn(param);
        } catch (error) {
          entriesByAccess.remove(entryState);
          entriesByHash.delete(paramHash);
          throw error;
        }

        entryState.isBeingUsed = false;
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
