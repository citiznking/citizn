<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { Map as MlMap, Marker, Popup, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { supabase } from '$lib/supabase';

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
		lng: number;
		lat: number;
		campaign_id: string | null;
		created_at: string;
	}

	let campaign: Campaign | null = $state(null);
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
		const { data: campaignRow, error: campaignErr } = await supabase
			.from('campaigns')
			.select(
				'id, name, description, status, reward_count, min_submissions, reward_mode, ends_at, countries!inner(url_slug)',
			)
			.eq('slug', slug)
			.eq('countries.url_slug', 'Nig')
			.maybeSingle();

		if (campaignErr || !campaignRow) {
			loadError = campaignErr?.message ?? 'campaign not found';
			loading = false;
			return;
		}
		campaign = campaignRow as unknown as Campaign;

		const { data, error } = await supabase.rpc('published_reports', { p_country_slug: 'Nig' });
		if (error) {
			loadError = error.message;
		} else {
			reports = ((data ?? []) as Row[]).filter((r) => r.campaign_id === campaign!.id);
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

{#if loading}
	<p>Loading…</p>
{:else if loadError}
	<p role="alert">Error: {loadError}</p>
{:else if campaign}
	<h1>{campaign.name}</h1>
	{#if campaign.description}<p>{campaign.description}</p>{/if}
	{#if campaign.status === 'active'}
		<p>
			<a href="/Nig/report?campaign={slug}">Report for this campaign</a>
			· {campaign.reward_count} reward{campaign.reward_count === 1 ? '' : 's'}
			{#if campaign.reward_mode === 'first_n'}
				· first {campaign.reward_count} to qualify win, no draw
			{:else}
				· winners drawn at random from everyone who qualifies
			{/if}
			{#if campaign.ends_at}· closes {new Date(campaign.ends_at).toLocaleDateString()}{/if}
		</p>
		{#if campaign.min_submissions > 1}
			<p><small>Requires {campaign.min_submissions} published reports under this campaign to qualify.</small></p>
		{/if}
		<p>Got a claim code from a previous report? <a href="/claim">Check it here</a>.</p>
	{:else}
		<p>This campaign is closed. Have a claim code? <a href="/claim">Check it here</a>.</p>
	{/if}

	<div bind:this={mapContainer} style="width: 100%; height: 320px; margin-bottom: 1rem;"></div>

	{#if reports.length === 0}
		<p>No published reports in this campaign yet.</p>
	{:else}
		<ul>
			{#each reports as r (r.id)}
				<li>
					<strong>{r.category}</strong> — {r.severity}
					{#if r.description}<br />{r.description}{/if}
					<br /><small>{new Date(r.created_at).toLocaleString()}</small>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
