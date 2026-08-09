<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { Map as MlMap, Marker, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { supabase } from '$lib/supabase';
	import ReportCard from '$lib/components/ReportCard.svelte';
	import Trophy from 'lucide-svelte/icons/trophy';
	import Award from 'lucide-svelte/icons/award';
	import MapPin from 'lucide-svelte/icons/map-pin';
	import Newspaper from 'lucide-svelte/icons/newspaper';
	import Hash from 'lucide-svelte/icons/hash';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import { getCategory } from '$lib/design/categories';
	import { SEVERITY_RADIUS } from '$lib/design/severity';

	const slug = page.params.slug;

	interface Campaign {
		id: string;
		name: string;
		description: string | null;
		status: string;
		reward_count: number;
		min_submissions: number;
		reward_mode: 'raffle' | 'first_n';
		ends_at: string | null;
	}
	interface Row {
		id: string;
		category: string;
		severity: string;
		description: string | null;
		status: string;
		lifecycle: string;
		lng: number;
		lat: number;
		level1_id: string;
		campaign_id: string | null;
		created_at: string;
	}

	let campaign: Campaign | null = $state(null);
	let reports: Row[] = $state([]);
	let levelNames: Record<string, string> = $state({});
	let statesCovered = $derived(new Set(reports.map((r) => r.level1_id)).size);
	let loading = $state(true);
	let loadError = $state('');

	let mapContainer: HTMLDivElement = $state()!;
	let map: MlMap;
	const markers: Marker[] = [];

	const OSM_STYLE: StyleSpecification = {
		version: 8,
		sources: {
			osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap contributors' },
		},
		layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
	};

	onMount(async () => {
		const { data: campaignRow, error: campaignErr } = await supabase
			.from('campaigns')
			.select('id, name, description, status, reward_count, min_submissions, reward_mode, ends_at, countries!inner(url_slug)')
			.eq('slug', slug)
			.eq('countries.url_slug', 'Nig')
			.maybeSingle();

		if (campaignErr || !campaignRow) {
			loadError = campaignErr?.message ?? 'campaign not found';
			loading = false;
			return;
		}
		campaign = campaignRow as unknown as Campaign;

		const [{ data, error }, { data: levels }] = await Promise.all([
			supabase.rpc('published_reports', { p_country_slug: 'Nig' }),
			supabase.from('admin_level1').select('id, name, countries!inner(url_slug)').eq('countries.url_slug', 'Nig'),
		]);
		if (error) {
			loadError = error.message;
		} else {
			reports = ((data ?? []) as Row[]).filter((r) => r.campaign_id === campaign!.id);
		}
		levelNames = Object.fromEntries((levels ?? []).map((l: any) => [l.id, l.name]));
		loading = false;

		map = new MlMap({ container: mapContainer, style: OSM_STYLE, center: [8.6753, 9.082], zoom: 5.5 });
		for (const r of reports) {
			const cat = getCategory(r.category);
			const radius = SEVERITY_RADIUS[r.severity] ?? 8;
			const el = document.createElement('div');
			el.style.width = `${radius * 2}px`;
			el.style.height = `${radius * 2}px`;
			el.style.borderRadius = '9999px';
			el.style.background = cat.color;
			el.style.border = '2px solid white';
			el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
			markers.push(new Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(map));
		}
	});

	onDestroy(() => {
		markers.forEach((m) => m.remove());
		map?.remove();
	});
</script>

<div class="flex-1 overflow-y-auto scrollbar-none pb-6">
	{#if loading}
		<p class="text-sm text-muted-foreground text-center py-12">Loading…</p>
	{:else if loadError}
		<p role="alert" class="text-sm text-destructive text-center py-12">Error: {loadError}</p>
	{:else if campaign}
		<div class="mx-4 mt-4 rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
			<div class="px-5 pt-5 pb-4" style="background: linear-gradient(135deg, #0F2151 0%, #1B3C8A 60%, #173E8C 100%);">
				<div class="flex items-start justify-between mb-3">
					<div>
						<p class="text-blue-300 text-[10px] font-bold uppercase tracking-widest mb-0.5">
							{campaign.status === 'active' ? 'Active Campaign' : 'Closed'}
						</p>
						<h1 class="text-white text-2xl font-semibold font-display">{campaign.name}</h1>
					</div>
					<div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
						<Trophy size={20} class="text-amber-300" />
					</div>
				</div>
				{#if campaign.description}
					<p class="text-blue-200 text-sm leading-relaxed">{campaign.description}</p>
				{/if}
			</div>

			<div class="px-5 py-4 border-b border-border">
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Newspaper size={13} class="text-primary" />
						<span>{reports.length} report{reports.length === 1 ? '' : 's'}</span>
					</div>
					<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
						<MapPin size={13} class="text-primary" />
						<span>{statesCovered} state{statesCovered === 1 ? '' : 's'} covered</span>
					</div>
				</div>
			</div>

			<div class="px-5 py-4 border-b border-border">
				<div class="flex items-start gap-3">
					<div class="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
						<Award size={18} class="text-amber-600" />
					</div>
					<div class="flex-1">
						<p class="text-sm font-semibold text-foreground mb-0.5">
							{campaign.reward_count} reward{campaign.reward_count === 1 ? '' : 's'}
						</p>
						<p class="text-xs text-muted-foreground leading-relaxed">
							{#if campaign.reward_mode === 'first_n'}
								The first {campaign.reward_count} qualifying reporters win — no draw, no waiting.
							{:else}
								Winners are drawn at random from everyone who qualifies once the campaign closes.
							{/if}
							{#if campaign.min_submissions > 1}
								Requires {campaign.min_submissions} published reports under this campaign to qualify.
							{/if}
						</p>
					</div>
				</div>
				{#if campaign.ends_at}
					<div class="mt-3 flex items-center justify-between bg-muted rounded-xl px-3.5 py-2.5">
						<span class="text-xs text-muted-foreground">Closes</span>
						<span class="text-xs font-semibold text-foreground font-code">{new Date(campaign.ends_at).toLocaleDateString()}</span>
					</div>
				{/if}
			</div>

			<div class="px-5 py-4">
				{#if campaign.status === 'active'}
					<a
						href="/Nig/report?campaign={slug}"
						class="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
					>
						Report for this campaign <ArrowRight size={16} />
					</a>
				{:else}
					<p class="text-sm text-muted-foreground text-center">This campaign is closed.</p>
				{/if}
			</div>
		</div>

		<div class="mx-4 mt-2 rounded-2xl border border-border bg-card p-5 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Hash size={15} class="text-primary" />
				<span class="text-sm font-semibold text-foreground">Got a claim code?</span>
			</div>
			<a href="/claim" class="text-sm text-primary font-medium flex items-center gap-1">Check it <ArrowRight size={13} /></a>
		</div>

		<div bind:this={mapContainer} class="mx-4 mt-4 h-56 rounded-2xl overflow-hidden border border-border"></div>

		{#if reports.length > 0}
			<div class="px-4 mt-5">
				<h3 class="text-sm font-semibold text-foreground mb-3">Recent campaign reports</h3>
				<div class="space-y-3">
					{#each reports as r (r.id)}
						<ReportCard
							id={r.id}
							category={r.category}
							severity={r.severity}
							status={r.status}
							lifecycle={r.lifecycle}
							description={r.description}
							createdAt={r.created_at}
							locationLabel={levelNames[r.level1_id] ?? ''}
							compact
						/>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
