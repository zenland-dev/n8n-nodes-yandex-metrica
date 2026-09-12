/**
 * A short-lived memo for the reads that fill dropdowns.
 *
 * Opening a node with several counter-aware pickers fires several requests, and
 * the editor re-runs them whenever a dependent parameter changes. Yandex allows
 * an account 5000 API calls a day across every integration signed in as it, so
 * a picker that re-reads the counter list on every keystroke is spending the
 * budget of the workflows doing actual work. Dictionary reads are therefore
 * shared for a short while, per credential.
 *
 * The window is deliberately small: somebody who has just created a goal in
 * Metrica should see it after a breath, not after restarting n8n.
 */

const TTL_MS = 60_000;

/**
 * The window for a read that describes configuration rather than data.
 *
 * A counter list, a goal list, the set of labels on an account — these change
 * when somebody edits them in the Metrica interface, which is a rare event
 * rather than a stream. Holding them longer turns a session of opening and
 * closing a node into a single request.
 *
 * Two minutes rather than more, because n8n offers a **Refresh List** action in
 * every dropdown's menu and that action cannot reach past this memo: the request
 * it makes is indistinguishable from the one that filled it. A refresh that does
 * nothing for five minutes reads as a broken button, so the window is short
 * enough to be waited out.
 *
 * Two minutes rather than less, because it is not what keeps the account's daily
 * budget safe — `acquireSlot` does. This is politeness; the limiter is the
 * guarantee.
 */
export const CONFIG_TTL_MS = 120_000;

const entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

function prune(now: number): void {
	for (const [key, entry] of entries) {
		if (entry.expiresAt <= now) entries.delete(key);
	}
}

/**
 * Runs `fetch` unless an identical call is already memoised.
 *
 * A rejection is never remembered: the usual cause is a credential the user is
 * still filling in, and they would otherwise have to wait out the TTL. The
 * rejection still reaches this caller.
 */
export async function cached<T>(key: string, fetch: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
	const now = Date.now();
	prune(now);

	const hit = entries.get(key);
	if (hit !== undefined) return (await hit.value) as T;

	const value = fetch();
	entries.set(key, { expiresAt: now + ttlMs, value });
	void value.catch(() => entries.delete(key));

	return await value;
}

/** Test seam: forget every memoised read. */
export function resetCache(): void {
	entries.clear();
}
