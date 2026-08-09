<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { REPORT_CATEGORIES } from '$lib/reports';

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
	let lines: Line[] = $state([]);
	let loading = $state(true);

	function sectorLabel(v: string) {
		return REPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
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
			.select('id, name, countries!inner(url_slug)')
			.eq('countries.url_slug', 'Nig')
			.order('name');
		levels = (data ?? []).map((r: any) => ({ id: r.id, name: r.name }));
		if (levels.length > 0) {
			level1Id = levels[0].id;
			await loadLines();
		} else {
			loading = false;
		}
	});
</script>

<h1>State budgets</h1>
<p>
	Approved state budget line items by sector, as published by each state — compare against what's
	actually reported broken on the ground.
</p>
<p><small>
	LGA-level federal allocation figures aren't available yet — that needs LGA reference data this
	build doesn't have seeded.
</small></p>

<label>
	State
	<select bind:value={level1Id} onchange={loadLines}>
		{#each levels as l (l.id)}
			<option value={l.id}>{l.name}</option>
		{/each}
	</select>
</label>

{#if loading}
	<p>Loading…</p>
{:else if lines.length === 0}
	<p>No budget data recorded for this state yet.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th>Year</th>
				<th>Sector</th>
				<th>Line item</th>
				<th>Approved amount</th>
				<th>Source</th>
			</tr>
		</thead>
		<tbody>
			{#each lines as l (l.id)}
				<tr>
					<td>{l.fiscal_year}</td>
					<td>{sectorLabel(l.sector)}</td>
					<td>{l.line_item}</td>
					<td>{l.approved_amount.toLocaleString()}</td>
					<td>
						{#if l.budget_sources?.url}
							<a href={l.budget_sources.url} target="_blank" rel="noreferrer">{l.budget_sources.platform}</a>
						{:else}
							{l.budget_sources?.platform ?? ''}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
