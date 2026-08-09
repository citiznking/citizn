<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { REPORT_CATEGORIES } from '$lib/reports';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';

	let levels: { id: string; name: string }[] = $state([]);
	let level1Id = $state('');
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
		const { data } = await supabase
			.from('admin_level1')
			.select('id, name, countries!inner(url_slug)')
			.eq('countries.url_slug', 'Nig')
			.order('name');
		levels = (data ?? []).map((r: any) => ({ id: r.id, name: r.name }));
		if (levels.length > 0) level1Id = levels[0].id;
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
				headers: {
					'Content-Type': 'application/json',
					apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
					Authorization: `Bearer ${token}`,
				},
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

<h1>Add a state budget line</h1>
<p><a href="/mod">&larr; moderation queue</a></p>

<form onsubmit={submit}>
	<label>
		State
		<select bind:value={level1Id} required>
			{#each levels as l (l.id)}
				<option value={l.id}>{l.name}</option>
			{/each}
		</select>
	</label>

	<label>
		Fiscal year
		<input type="number" bind:value={fiscalYear} required />
	</label>

	<label>
		Sector
		<select bind:value={sector} required>
			{#each REPORT_CATEGORIES as c (c.value)}
				<option value={c.value}>{c.label}</option>
			{/each}
		</select>
	</label>

	<label>
		Line item
		<input type="text" bind:value={lineItem} required placeholder="e.g. Rural road rehabilitation" />
	</label>

	<label>
		Approved amount (NGN)
		<input type="number" bind:value={approvedAmount} required min="0" step="0.01" />
	</label>

	<label>
		Source platform
		<input type="text" bind:value={platform} required placeholder="e.g. State Ministry of Finance" />
	</label>

	<label>
		Source URL (optional)
		<input type="url" bind:value={sourceUrl} placeholder="https://…" />
	</label>

	<label>
		How was this retrieved?
		<select bind:value={method}>
			<option value="manual">Manual entry</option>
			<option value="scrape">Scraped</option>
			<option value="api">API</option>
		</select>
	</label>

	<button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add'}</button>
</form>

{#if result}
	{#if result.ok}
		<p role="status">Added.</p>
	{:else}
		<p role="alert">{result.error}</p>
	{/if}
{/if}
