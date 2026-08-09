<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { CATEGORIES } from '$lib/design/categories';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';
	import Vote from 'lucide-svelte/icons/vote';

	interface Row {
		id: string;
		category: string;
		severity: string;
		description: string | null;
		status: string;
		lifecycle: string;
		level1_id: string;
		created_at: string;
	}

	let reports: Row[] = $state([]);
	let levelNames: Record<string, string> = $state({});
	let loading = $state(true);
	let loadError = $state('');
	let filter = $state('all');

	let visible = $derived(filter === 'all' ? reports : reports.filter((r) => r.category === filter));

	onMount(async () => {
		const [{ data, error }, { data: levels }] = await Promise.all([
			supabase.rpc('published_reports', { p_country_slug: 'Nig' }),
			supabase.from('admin_level1').select('id, name, countries!inner(url_slug)').eq('countries.url_slug', 'Nig'),
		]);
		if (error) {
			loadError = error.message;
		} else {
			reports = ((data ?? []) as Row[]).sort(
				(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
			);
		}
		levelNames = Object.fromEntries((levels ?? []).map((l: any) => [l.id, l.name]));
		loading = false;
	});
</script>

<div class="flex flex-col h-full">
	<a
		href="/Nig/2027election"
		class="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white shrink-0"
		style="background: linear-gradient(135deg, #0F2151 0%, #1B3C8A 100%);"
	>
		<Vote size={13} />
		2027 General Election — report what you see at your polling unit
	</a>
	<div class="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none shrink-0 border-b border-border">
		<button
			onclick={() => (filter = 'all')}
			class="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors {filter === 'all'
				? 'bg-primary text-primary-foreground'
				: 'bg-secondary text-secondary-foreground'}"
		>
			All
		</button>
		{#each CATEGORIES as c (c.id)}
			<button
				onclick={() => (filter = c.id)}
				class="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors {filter === c.id
					? 'bg-primary text-primary-foreground'
					: 'bg-secondary text-secondary-foreground'}"
			>
				{c.label}
			</button>
		{/each}
	</div>

	<div class="px-4 py-2.5 flex items-center justify-between shrink-0">
		<p class="text-xs text-muted-foreground flex items-center gap-1.5">
			<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
			<span class="font-code">{visible.length}</span> reports
		</p>
		<span class="flex items-center gap-1 text-xs text-muted-foreground">
			<SlidersHorizontal size={12} /> Filter
		</span>
	</div>

	<div class="flex-1 px-4 pb-6 space-y-3.5">
		{#if loading}
			<p class="text-sm text-muted-foreground text-center py-12">Loading…</p>
		{:else if loadError}
			<p role="alert" class="text-sm text-destructive text-center py-12">Error: {loadError}</p>
		{:else if visible.length === 0}
			<div class="text-center py-12">
				<p class="text-sm text-muted-foreground">No reports in this category yet.</p>
				<a href="/Nig/report" class="mt-3 text-sm text-primary font-medium inline-block">Be the first to report</a>
			</div>
		{:else}
			{#each visible as r (r.id)}
				<ReportCard
					id={r.id}
					category={r.category}
					severity={r.severity}
					status={r.status}
					lifecycle={r.lifecycle}
					description={r.description}
					createdAt={r.created_at}
					locationLabel={levelNames[r.level1_id] ?? ''}
				/>
			{/each}
		{/if}
	</div>
</div>
