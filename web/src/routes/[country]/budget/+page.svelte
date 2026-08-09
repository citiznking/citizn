<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import { CATEGORIES } from '$lib/design/categories';

	const country = page.params.country;

	interface Line {
		id: string;
		fiscal_year: number;
		sector: string;
		line_item: string;
		approved_amount: number;
		budget_sources: { platform: string; url: string | null; retrieved_at: string } | null;
	}

	let levels: { id: string; name: string }[] = $state([]);
	let level1Id = $state('');
	let level1Label = $state('State');
	let lines: Line[] = $state([]);
	let loading = $state(true);

	function sectorLabel(v: string) {
		return CATEGORIES.find((c) => c.id === v)?.label ?? v;
	}

	async function loadLines() {
		if (!level1Id) return;
		loading = true;
		const { data } = await supabase
			.from('state_budget_lines')
			.select('id, fiscal_year, sector, line_item, approved_amount, budget_sources(platform, url, retrieved_at)')
			.eq('level1_id', level1Id)
			.order('fiscal_year', { ascending: false });
		lines = (data ?? []) as unknown as Line[];
		loading = false;
	}

	onMount(async () => {
		const { data } = await supabase
			.from('admin_level1')
			.select('id, name, label, countries!inner(url_slug)')
			.eq('countries.url_slug', country)
			.order('name');
		levels = (data ?? []).map((r: any) => ({ id: r.id, name: r.name }));
		level1Label = (data?.[0] as any)?.label ?? 'State';
		if (levels.length > 0) {
			level1Id = levels[0].id;
			await loadLines();
		} else {
			loading = false;
		}
	});
</script>

<a href="/{country}" class="text-sm text-primary font-medium">&larr; Back to Citizn</a>

<h1 class="text-2xl font-semibold font-display mt-3 mb-1">{level1Label} budgets</h1>
<p class="text-sm text-muted-foreground mb-1 leading-relaxed">
	Approved {level1Label.toLowerCase()} budget line items by sector, as published — compare against what's
	actually reported broken on the ground.
</p>
<p class="text-xs text-muted-foreground mb-5">
	Local-level federal allocation figures aren't available yet — that needs finer-grained reference data this build doesn't have seeded.
</p>

<label class="block mb-5 max-w-xs">
	<span class="block text-sm font-medium text-foreground mb-1.5">{level1Label}</span>
	<select bind:value={level1Id} onchange={loadLines} class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
		{#each levels as l (l.id)}
			<option value={l.id}>{l.name}</option>
		{/each}
	</select>
</label>

{#if loading}
	<p class="text-sm text-muted-foreground">Loading…</p>
{:else if lines.length === 0}
	<p class="text-sm text-muted-foreground">No budget data recorded for this state yet.</p>
{:else}
	<div class="overflow-x-auto border border-border rounded-2xl">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-border bg-muted/50 text-left">
					<th class="px-4 py-2.5 font-medium text-muted-foreground">Year</th>
					<th class="px-4 py-2.5 font-medium text-muted-foreground">Sector</th>
					<th class="px-4 py-2.5 font-medium text-muted-foreground">Line item</th>
					<th class="px-4 py-2.5 font-medium text-muted-foreground text-right">Amount</th>
					<th class="px-4 py-2.5 font-medium text-muted-foreground">Source</th>
				</tr>
			</thead>
			<tbody>
				{#each lines as l (l.id)}
					<tr class="border-b border-border last:border-0">
						<td class="px-4 py-2.5 font-code">{l.fiscal_year}</td>
						<td class="px-4 py-2.5">{sectorLabel(l.sector)}</td>
						<td class="px-4 py-2.5">{l.line_item}</td>
						<td class="px-4 py-2.5 text-right font-code">{l.approved_amount.toLocaleString()}</td>
						<td class="px-4 py-2.5">
							{#if l.budget_sources?.url}
								<a href={l.budget_sources.url} target="_blank" rel="noreferrer" class="text-primary">{l.budget_sources.platform}</a>
							{:else}
								{l.budget_sources?.platform ?? ''}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
