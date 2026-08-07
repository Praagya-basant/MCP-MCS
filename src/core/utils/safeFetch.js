/**
 * Wraps a single data-fetch promise so its failure can't take down a
 * page that's assembling several independent queries via Promise.all —
 * without this, one flaky/misnamed table or a transient PostgREST
 * schema-cache miss rejects the whole batch and the page shows nothing
 * instead of everything-except-that-one-thing. Logs to the console so
 * the failure is still visible for debugging, just not fatal.
 */
export async function safeFetch(promise, fallback) {
  try {
    return await promise;
  } catch (err) {
    console.error('safeFetch: query failed, using fallback', err);
    return fallback;
  }
}
