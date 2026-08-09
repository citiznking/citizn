<script lang="ts">
	import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
	import Hash from 'lucide-svelte/icons/hash';
	import CheckCircle2 from 'lucide-svelte/icons/check-circle-2';

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
			body: JSON.stringify({ token: token.trim(), network_provider_id: withProvider ? selectedProvider : undefined }),
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

<div class="flex items-center gap-2 mb-1">
	<Hash size={18} class="text-primary" />
	<h1 class="text-2xl font-semibold font-display">Check your claim code</h1>
</div>
<p class="text-sm text-muted-foreground mb-5 leading-relaxed">
	If you reported under a campaign, you got a code when you submitted. Paste it below to see if you
	won — this is the only way we can look it up, since we don't keep anything that links a report
	back to you.
</p>

<form onsubmit={check} class="mb-5">
	<label for="token" class="block text-sm font-medium text-foreground mb-2">Claim code</label>
	<div class="flex gap-2">
		<input
			id="token"
			type="text"
			bind:value={token}
			required
			minlength="32"
			class="flex-1 bg-input-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary font-code"
		/>
		<button type="submit" disabled={checking} class="px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50">
			{checking ? 'Checking…' : 'Check'}
		</button>
	</div>
</form>

{#if result}
	{#if result.ok}
		{#if result.status === 'active'}
			<p class="text-sm text-muted-foreground">No draw yet, or this report wasn't selected. Check back after the campaign closes.</p>
		{:else if result.status === 'expired'}
			<p class="text-sm text-muted-foreground">This campaign closed without your report being selected.</p>
		{:else if 'needsNetworkProvider' in result && result.needsNetworkProvider}
			<div class="border border-border rounded-2xl bg-card p-5">
				<p class="text-sm font-semibold text-foreground mb-3">You won. Choose your network to receive it.</p>
				<form onsubmit={redeem} class="flex gap-2">
					<select bind:value={selectedProvider} required class="flex-1 bg-input-background border border-border rounded-xl px-4 py-3 text-sm">
						<option value="" disabled>Select a network</option>
						{#each result.providers as p (p.id)}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
					<button
						type="submit"
						disabled={redeeming || !selectedProvider}
						class="px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50"
					>
						{redeeming ? 'Redeeming…' : 'Redeem'}
					</button>
				</form>
			</div>
		{:else if result.status === 'redeemed'}
			<div class="border border-border rounded-2xl bg-card p-5">
				<p class="text-sm font-semibold text-emerald-700 flex items-center gap-1.5 mb-2"><CheckCircle2 size={16} /> Redeemed</p>
				<code class="block text-lg font-code font-bold select-all bg-muted rounded-lg px-3 py-2">{result.code}</code>
				{#if result.value_amount}<p class="text-sm text-muted-foreground mt-2">{result.value_amount} {result.currency}</p>{/if}
			</div>
		{/if}
	{:else}
		<p class="text-sm text-destructive">{result.error}</p>
	{/if}
{/if}
