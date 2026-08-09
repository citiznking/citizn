<script lang="ts">
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

	interface Provider {
		id: string;
		name: string;
		code: string;
	}

	let token = $state('');
	let checking = $state(false);
	let redeeming = $state(false);
	let selectedProvider = $state('');
	let result:
		| { ok: true; status: string; code?: string; value_amount?: number; currency?: string }
		| { ok: true; status: 'won'; needsNetworkProvider: true; providers: Provider[] }
		| { ok: false; error: string }
		| null = $state(null);

	async function callClaim(withProvider: boolean) {
		const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/campaign-claim`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', apikey: PUBLIC_SUPABASE_PUBLISHABLE_KEY },
			body: JSON.stringify({
				token: token.trim(),
				network_provider_id: withProvider ? selectedProvider : undefined,
			}),
		});
		const body = await res.json();
		if (!res.ok) {
			result = { ok: false, error: body.error ?? `request failed (${res.status})` };
			return;
		}
		if (body.needs_network_provider) {
			result = { ok: true, status: 'won', needsNetworkProvider: true, providers: body.network_providers };
		} else {
			result = { ok: true, ...body };
		}
	}

	async function check(e: SubmitEvent) {
		e.preventDefault();
		checking = true;
		result = null;
		try {
			await callClaim(false);
		} catch (err) {
			result = { ok: false, error: (err as Error).message };
		} finally {
			checking = false;
		}
	}

	async function redeem(e: SubmitEvent) {
		e.preventDefault();
		redeeming = true;
		try {
			await callClaim(true);
		} catch (err) {
			result = { ok: false, error: (err as Error).message };
		} finally {
			redeeming = false;
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
		{:else if 'needsNetworkProvider' in result && result.needsNetworkProvider}
			<div role="status" style="border: 2px solid; padding: 1rem;">
				<p><strong>You won.</strong> Choose your network to receive it.</p>
				<form onsubmit={redeem}>
					<label>
						Network
						<select bind:value={selectedProvider} required>
							<option value="" disabled>Select a network</option>
							{#each result.providers as p (p.id)}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
					</label>
					<button type="submit" disabled={redeeming || !selectedProvider}>
						{redeeming ? 'Redeeming…' : 'Redeem'}
					</button>
				</form>
			</div>
		{:else if result.status === 'redeemed'}
			<div role="status" style="border: 2px solid; padding: 1rem;">
				<p><strong>Redeemed.</strong></p>
				<code style="font-size: 1.1rem; user-select: all;">{result.code}</code>
				{#if result.value_amount}<p>{result.value_amount} {result.currency}</p>{/if}
			</div>
		{/if}
	{:else}
		<p role="alert">{result.error}</p>
	{/if}
{/if}
