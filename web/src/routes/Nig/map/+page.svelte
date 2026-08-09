<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Map as MlMap, Marker, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { supabase } from '$lib/supabase';
	import { getCategory, CATEGORIES } from '$lib/design/categories';
	import { SEVERITY, SEVERITY_RADIUS } from '$lib/design/severity';
	import ReportCard from '$lib/components/ReportCard.svelte';

	interface Row {
		id: string;
		category: string;
		severity: string;
		description: string | null;
		status: string;
		lifecycle: string;
		level1_id: string;
		created_at: string;
		lng: number;
		lat: number;
	}

	let reports: Row[] = $state([]);
	let levelNames: Record<string, string> = $state({});
	let selected: Row | null = $state(null);

	let mapContainer: HTMLDivElement = $state()!;
	let map: MlMap;
	const markers: Marker[] = [];

	const OSM_STYLE: StyleSpecification = {
		version: 8,
		sources: {
			osm: {
				type: 'raster',
				tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
				tileSize: 256,
				attribution: '&copy; OpenStreetMap contributors',
			},
		},
		layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
	};

	onMount(async () => {
		const [{ data }, { data: levels }] = await Promise.all([
			supabase.rpc('published_reports', { p_country_slug: 'Nig' }),
			supabase.from('admin_level1').select('id, name, countries!inner(url_slug)').eq('countries.url_slug', 'Nig'),
		]);
		reports = (data ?? []) as Row[];
		levelNames = Object.fromEntries((levels ?? []).map((l: any) => [l.id, l.name]));

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
			el.style.cursor = 'pointer';
			el.addEventListener('click', () => (selected = selected?.id === r.id ? null : r));

			const marker = new Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(map);
			markers.push(marker);
		}
	});

	onDestroy(() => {
		markers.forEach((m) => m.remove());
		map?.remove();
	});
</script>

<div class="relative h-full flex flex-col overflow-hidden">
	<div class="absolute top-0 left-0 right-0 z-10 px-4 pt-3 pb-2 pointer-events-none">
		<div class="flex gap-2 overflow-x-auto scrollbar-none pointer-events-auto">
			<span class="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-sm whitespace-nowrap shrink-0">All</span>
			{#each CATEGORIES.slice(0, 6) as cat (cat.id)}
				<span class="px-3.5 py-1.5 rounded-full text-xs font-medium bg-card/90 backdrop-blur-sm text-foreground border border-border shadow-sm whitespace-nowrap shrink-0">
					{cat.label}
				</span>
			{/each}
		</div>
	</div>

	<div bind:this={mapContainer} class="absolute inset-0"></div>

	<div class="absolute top-14 right-4 z-10">
		<div class="bg-card/90 backdrop-blur-sm rounded-xl border border-border p-2.5 shadow-sm">
			{#each ['critical', 'high', 'medium', 'low'] as s (s)}
				<div class="flex items-center gap-1.5 mb-1 last:mb-0">
					<div class="w-2.5 h-2.5 rounded-full {SEVERITY[s].dot}"></div>
					<span class="text-[9px] text-foreground font-medium">{SEVERITY[s].label}</span>
				</div>
			{/each}
		</div>
	</div>

	{#if selected}
		<div class="absolute bottom-4 left-4 right-4 z-10">
			<ReportCard
				id={selected.id}
				category={selected.category}
				severity={selected.severity}
				status={selected.status}
				lifecycle={selected.lifecycle}
				description={selected.description}
				createdAt={selected.created_at}
				locationLabel={levelNames[selected.level1_id] ?? ''}
				compact
			/>
		</div>
	{/if}
</div>
