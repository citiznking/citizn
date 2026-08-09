<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { CATEGORIES } from '$lib/design/categories';
	import { COUNTRIES } from '$lib/countries';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';

	let country = $state('Nig');
	let levels: { id: string; name: string; label: string }[] = $state([]);
	let level1Id = $state('');

	async function loadLevels() {
		const { data } = await supabase
			.from('admin_level1')
			.select('id, name, label, countries!inner(url_slug)')
			.eq('countries.url_slug', country)
			.order('name');
		levels = (data ?? []).map((r: any) => ({ id: r.id, name: r.name, label: r.label }));
		level1Id = levels.length > 0 ? levels[0].id : '';
	}
	let fiscalYear = $state(new Date().getFullYear());
	let sector = $state('road');
	let lineItem = $state('');
	let approvedAmount = $state<number | null>(null);
	let platform = $state('');
	let sourceUrl = $state('');
	let method = $state('manual');

	let submitting = $state(false);
	let result: { ok: true } | { ok: false; error: string } | null = $state(null);

	onMount(async () => {
		const { data: session } = await supabase.auth.getSession();
		if (!session.session) {
			await goto('/mod/login');
			return;
		}
		await loadLevels();
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
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/add-budget-entry`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					platform,
					url: sourceUrl || undefined,
					retrieved_at: new Date().toISOString(),
					method,
					level1_id: level1Id,
					fiscal_year: fiscalYear,
					sector,
					line_item: lineItem,
					approved_amount: approvedAmount,
				}),
			});
			const body = await res.json();
			if (!res.ok) {
				result = { ok: false, error: body.error ?? `request failed (${res.status})` };
			} else {
				result = { ok: true };
				lineItem = '';
				approvedAmount = null;
			}
		} catch (err) {
			result = { ok: false, error: (err as Error).message };
		} finally {
			submitting = false;
		}
	}
</script>

<a href="/mod" class="text-sm text-primary font-medium">&larr; moderation queue</a>
<h1 class="text-2xl font-semibold font-display mt-3 mb-5">Add a state budget line</h1>

<form onsubmit={submit} class="space-y-4 max-w-md">
	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Country</span>
		<select bind:value={country} onchange={loadLevels} class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
			{#each COUNTRIES as c (c.slug)}
				<option value={c.slug}>{c.name}</option>
			{/each}
		</select>
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">{levels[0]?.label ?? 'State'}</span>
		<select bind:value={level1Id} required class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
			{#each levels as l (l.id)}
				<option value={l.id}>{l.name}</option>
			{/each}
		</select>
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Fiscal year</span>
		<input type="number" bind:value={fiscalYear} required class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Sector</span>
		<select bind:value={sector} required class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
			{#each CATEGORIES as c (c.id)}
				<option value={c.id}>{c.label}</option>
			{/each}
		</select>
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Line item</span>
		<input type="text" bind:value={lineItem} required placeholder="e.g. Rural road rehabilitation" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Approved amount (NGN)</span>
		<input type="number" bind:value={approvedAmount} required min="0" step="0.01" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Source platform</span>
		<input type="text" bind:value={platform} required placeholder="e.g. State Ministry of Finance" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Source URL (optional)</span>
		<input type="url" bind:value={sourceUrl} placeholder="https://…" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm" />
	</label>

	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">How was this retrieved?</span>
		<select bind:value={method} class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
			<option value="manual">Manual entry</option>
			<option value="scrape">Scraped</option>
			<option value="api">API</option>
		</select>
	</label>

	<button type="submit" disabled={submitting} class="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50">
		{submitting ? 'Saving…' : 'Add'}
	</button>
</form>

{#if result}
	{#if result.ok}
		<p class="text-sm text-emerald-700 mt-3">Added.</p>
	{:else}
		<p class="text-sm text-destructive mt-3">{result.error}</p>
	{/if}
{/if}
