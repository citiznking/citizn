<script lang="ts">
	import { supabase } from '$lib/supabase';
	import Vote from 'lucide-svelte/icons/vote';
	import Search from 'lucide-svelte/icons/search';

	interface Election {
		id: string;
		name: string;
		dates: Record<string, string>;
	}
	interface Pu {
		id: string;
		name: string;
		official_pu_code: string;
	}

	let election: Election | null = $state(null);
	let query = $state('');
	let results: Pu[] = $state([]);
	let searching = $state(false);

	supabase
		.from('elections')
		.select('id, name, dates, countries!inner(url_slug)')
		.eq('slug', '2027election')
		.eq('countries.url_slug', 'Nig')
		.maybeSingle()
		.then(({ data }) => {
			election = data as unknown as Election;
		});

	function daysUntil(dateStr: string | undefined): number | null {
		if (!dateStr) return null;
		const diff = new Date(dateStr).getTime() - Date.now();
		return Math.ceil(diff / (1000 * 60 * 60 * 24));
	}

	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(searchTimer);
		if (!query.trim()) {
			results = [];
			return;
		}
		searchTimer = setTimeout(async () => {
			searching = true;
			const { data } = await supabase
				.from('polling_units')
				.select('id, name, official_pu_code')
				.or(`name.ilike.%${query}%,official_pu_code.ilike.%${query}%`)
				.limit(20);
			results = (data ?? []) as Pu[];
			searching = false;
		}, 300);
	}
</script>

<div class="p-4">
	<div class="flex items-center gap-2 mb-1">
		<Vote size={20} class="text-primary" />
		<h1 class="text-2xl font-semibold font-display">{election?.name ?? '2027 General Election'}</h1>
	</div>
	<p class="text-sm text-muted-foreground mb-5">
		Anonymous, citizen-side election-day reporting — no accounts, no phone numbers, no names.
	</p>

	{#if election}
		<div class="grid grid-cols-2 gap-3 mb-6">
			{#if daysUntil(election.dates.presidential_nass) !== null}
				<div class="border border-border rounded-2xl p-4">
					<p class="text-2xl font-bold font-code text-primary">{daysUntil(election.dates.presidential_nass)}</p>
					<p class="text-xs text-muted-foreground mt-1">days to Presidential/NASS</p>
				</div>
			{/if}
			{#if daysUntil(election.dates.governorship_state_assembly) !== null}
				<div class="border border-border rounded-2xl p-4">
					<p class="text-2xl font-bold font-code text-primary">{daysUntil(election.dates.governorship_state_assembly)}</p>
					<p class="text-xs text-muted-foreground mt-1">days to Governorship/State Assembly</p>
				</div>
			{/if}
		</div>
	{/if}

	<h2 class="text-sm font-semibold text-foreground mb-2">Find your polling unit</h2>
	<div class="flex items-center gap-2 bg-input-background border border-border rounded-xl px-4 py-3 mb-3">
		<Search size={15} class="text-muted-foreground shrink-0" />
		<input
			type="text"
			bind:value={query}
			oninput={onSearchInput}
			placeholder="Search by name or PU code…"
			class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
		/>
	</div>

	{#if searching}
		<p class="text-sm text-muted-foreground">Searching…</p>
	{:else if query && results.length === 0}
		<p class="text-sm text-muted-foreground">
			No polling units found. Real polling-unit coordinates haven't been loaded into this build yet.
		</p>
	{:else}
		<div class="space-y-2">
			{#each results as pu (pu.id)}
				<a href="/Nig/2027election/day?pu={pu.id}" class="block border border-border rounded-xl px-4 py-3 active:bg-muted transition-colors">
					<p class="text-sm font-medium text-foreground">{pu.name}</p>
					<p class="text-xs text-muted-foreground font-code">{pu.official_pu_code}</p>
				</a>
			{/each}
		</div>
	{/if}

	<a href="/Nig/2027election/live" class="block text-center text-sm text-primary font-medium mt-6">View the live dashboard</a>
</div>
