<script lang="ts">
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import Trophy from 'lucide-svelte/icons/trophy';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import Hash from 'lucide-svelte/icons/hash';

	const country = page.params.country;

	interface Campaign {
		id: string;
		slug: string;
		name: string;
		description: string | null;
		status: string;
		reward_count: number;
		reward_mode: 'raffle' | 'first_n';
		ends_at: string | null;
	}

	let campaigns: Campaign[] = $state([]);
	let loading = $state(true);

	supabase
		.from('campaigns')
		.select('id, slug, name, description, status, reward_count, reward_mode, ends_at, countries!inner(url_slug)')
		.eq('countries.url_slug', country)
		.order('status')
		.then(({ data }) => {
			campaigns = (data ?? []) as unknown as Campaign[];
			loading = false;
		});
</script>

<div class="flex-1 overflow-y-auto scrollbar-none pb-6">
	<div class="px-4 pt-4 pb-2">
		<h1 class="text-2xl font-semibold font-display">Campaigns</h1>
		<p class="text-sm text-muted-foreground">Thematic reporting drives with rewards for participation.</p>
	</div>

	{#if loading}
		<p class="text-sm text-muted-foreground text-center py-12">Loading…</p>
	{:else if campaigns.length === 0}
		<p class="text-sm text-muted-foreground text-center py-12">No campaigns right now — check back soon.</p>
	{:else}
		<div class="px-4 space-y-3 mt-2">
			{#each campaigns as c (c.id)}
				<a
					href="/{country}/campaigns/{c.slug}"
					class="block rounded-2xl overflow-hidden border border-border bg-card shadow-sm active:scale-[0.99] transition-transform"
				>
					<div class="px-5 pt-4 pb-3" style="background: linear-gradient(135deg, #0F2151 0%, #1B3C8A 60%, #173E8C 100%);">
						<div class="flex items-start justify-between mb-1">
							<p class="text-blue-300 text-[10px] font-bold uppercase tracking-widest">
								{c.status === 'active' ? 'Active Campaign' : 'Closed'}
							</p>
							<Trophy size={18} class="text-amber-300" />
						</div>
						<h2 class="text-white text-xl font-semibold font-display">{c.name}</h2>
					</div>
					<div class="px-5 py-3.5 flex items-center justify-between">
						<span class="text-xs text-muted-foreground flex items-center gap-1.5">
							<Hash size={12} /> {c.reward_count} reward{c.reward_count === 1 ? '' : 's'} · {c.reward_mode === 'first_n' ? 'first to qualify' : 'random draw'}
						</span>
						<ArrowRight size={14} class="text-primary" />
					</div>
				</a>
			{/each}
		</div>
	{/if}

	<div class="px-4 mt-4">
		<a href="/claim" class="text-sm text-primary font-medium">Have a claim code? Check it here</a>
	</div>
</div>
