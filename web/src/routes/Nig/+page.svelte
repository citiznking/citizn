<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Map as MlMap, Marker, Popup, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { supabase } from '$lib/supabase';

	interface Row {
		id: string;
		category: string;
		severity: string;
		description: string | null;
		lng: number;
		lat: number;
		status: string;
		lifecycle: string;
		created_at: string;
	}

	let reports: Row[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');

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
		const { data, error } = await supabase.rpc('published_reports', { p_country_slug: 'Nig' });
		if (error) {
			loadError = error.message;
		} else {
			reports = (data ?? []) as Row[];
		}
		loading = false;

		map = new MlMap({
			container: mapContainer,
			style: OSM_STYLE,
			center: [3.3792, 6.5244],
			zoom: 6,
		});

		for (const r of reports) {
			const marker = new Marker()
				.setLngLat([r.lng, r.lat])
				.setPopup(new Popup().setText(`${r.category} (${r.severity})`))
				.addTo(map);
			markers.push(marker);
		}
	});

	onDestroy(() => {
		markers.forEach((m) => m.remove());
		map?.remove();
	});
</script>

<h1>Nigeria — condition reports</h1>
<p><a href="/Nig/report">Report an issue</a></p>

<div bind:this={mapContainer} style="width: 100%; height: 320px; margin-bottom: 1rem;"></div>

{#if loading}
	<p>Loading…</p>
{:else if loadError}
	<p role="alert">Error: {loadError}</p>
{:else if reports.length === 0}
	<p>No published reports yet.</p>
{:else}
	<ul>
		{#each reports as r (r.id)}
			<li>
				<strong>{r.category}</strong> — {r.severity} — {r.lifecycle}
				{#if r.description}<br />{r.description}{/if}
				<br /><small>{new Date(r.created_at).toLocaleString()}</small>
			</li>
		{/each}
	</ul>
{/if}
