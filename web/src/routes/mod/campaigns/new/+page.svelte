<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';

	let slug = $state('');
	let name = $state('');
	let description = $state('');
	let endsAt = $state('');
	let rewardCount = $state(10);
	let minSubmissions = $state(1);
	let rewardMode = $state<'raffle' | 'first_n'>('raffle');
	let redemptionMethod = $state<'voucher_code' | 'crypto_payout'>('voucher_code');

	let submitting = $state(false);
	let result: { ok: true; slug: string } | { ok: false; error: string } | null = $state(null);

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) await goto('/mod/login');
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		result = null;
		try {
			const { data: session } = await supabase.auth.getSession();
			const token = session.session?.access_token;
			if (!token) {
				await goto('/mod/login');
				return;
			}
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/create-campaign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					country_slug: 'Nig',
					slug,
					name,
					description: description || undefined,
					ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
					reward_count: rewardCount,
					min_submissions: minSubmissions,
					reward_mode: rewardMode,
					redemption_method: redemptionMethod,
				}),
			});
			const body = await res.json();
			if (!res.ok) {
				result = { ok: false, error: body.error ?? `request failed (${res.status})` };
			} else {
				result = { ok: true, slug: body.slug };
			}
		} catch (err) {
			result = { ok: false, error: (err as Error).message };
		} finally {
			submitting = false;
		}
	}
</script>

<a href="/mod" class="text-sm text-primary font-medium">&larr; moderation queue</a>
<h1 class="text-2xl font-semibold font-display mt-3 mb-5">Create a campaign</h1>

<form onsubmit={submit} class="space-y-4 max-w-md">
	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Slug</span>
		<input
			type="text"
			bind:value={slug}
			required
			pattern="[a-z0-9]+(-[a-z0-9]+)*"
			placeholder="e.g. vandals"
			class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm font-code"
		/>
		<span class="block text-xs text-muted-foreground mt-1">Lowercase, dashes only — used in the URL and the ?campaign= link.</span>
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Name</span>
		<input type="text" bind:value={name} required placeholder="e.g. Vandals" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Description</span>
		<textarea bind:value={description} rows="3" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm resize-none"></textarea>
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Ends at (optional)</span>
		<input type="date" bind:value={endsAt} class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Reward count</span>
		<input type="number" bind:value={rewardCount} required min="0" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Submissions required to qualify</span>
		<input type="number" bind:value={minSubmissions} required min="1" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Reward mode</span>
		<select bind:value={rewardMode} class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
			<option value="raffle">Raffle — random draw among everyone who qualifies</option>
			<option value="first_n">First N — instant win the moment you qualify</option>
		</select>
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Redemption method</span>
		<select bind:value={redemptionMethod} class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
			<option value="voucher_code">Voucher code (airtime etc.)</option>
			<option value="crypto_payout">Crypto payout</option>
		</select>
	</label>

	<button type="submit" disabled={submitting} class="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50">
		{submitting ? 'Creating…' : 'Create campaign'}
	</button>
</form>

{#if result}
	{#if result.ok}
		<p class="text-sm text-emerald-700 mt-3">
			Created — <a href="/Nig/campaigns/{result.slug}" class="underline">view it</a>
		</p>
	{:else}
		<p class="text-sm text-destructive mt-3">{result.error}</p>
	{/if}
{/if}
