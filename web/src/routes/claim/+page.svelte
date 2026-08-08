<script lang="ts">
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

	let token = $state('');
	let checking = $state(false);
	let result:
		| { ok: true; status: string; code?: string; value_amount?: number; currency?: string }
		| { ok: false; error: string }
		| null = $state(null);

	async function check(e: SubmitEvent) {
		e.preventDefault();
		checking = true;
		result = null;
		try {
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/campaign-claim`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: PUBLIC_SUPABASE_PUBLISHABLE_KEY },
				body: JSON.stringify({ token: token.trim() }),
			});
			const body = await res.json();
			if (!res.ok) {
				result = { ok: false, error: body.error ?? `request failed (${res.status})` };
			} else {
				result = { ok: true, ...body };
			}
		} catch (err) {
			result = { ok: false, error: (err as Error).message };
		} finally {
			checking = false;
		}
	}
</script>

<h1>Check your claim code</h1>
<p>
	If you reported under a campaign, you got a code when you submitted. Paste it below to see if
	you won — this is the only way we can look it up, since we don't keep anything that links a
	report back to you.
</p>

<form onsubmit={check}>
	<label>
		Claim code
		<input type="text" bind:value={token} required minlength="32" style="width: 100%;" />
	</label>
	<button type="submit" disabled={checking}>{checking ? 'Checking…' : 'Check'}</button>
</form>

{#if result}
	{#if result.ok}
		{#if result.status === 'active'}
			<p role="status">No draw yet, or this report wasn't selected. Check back after the campaign closes.</p>
		{:else if result.status === 'expired'}
			<p role="status">This campaign closed without your report being selected.</p>
		{:else if result.status === 'redeemed'}
			<div role="status" style="border: 2px solid; padding: 1rem;">
				<p><strong>You won!</strong></p>
				<code style="font-size: 1.1rem; user-select: all;">{result.code}</code>
				{#if result.value_amount}<p>{result.value_amount} {result.currency}</p>{/if}
			</div>
		{/if}
	{:else}
		<p role="alert">{result.error}</p>
	{/if}
{/if}
