<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Map as MlMap, Marker, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { supabase } from '$lib/supabase';
	import { getSessionUuid } from '$lib/session';
	import { REPORT_CATEGORIES, REPORT_SEVERITIES } from '$lib/reports';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';

	let mapContainer: HTMLDivElement = $state()!;
	let map: MlMap;
	let marker: Marker;

	let deviceLat: number | null = $state(null);
	let deviceLng: number | null = $state(null);
	let accuracyM: number | null = $state(null);
	let locating = $state(true);
	let locationError = $state('');

	let pinLat: number | null = $state(null);
	let pinLng: number | null = $state(null);

	let category = $state('road');
	let severity = $state('medium');
	let description = $state('');
	let levels: { id: string; name: string }[] = $state([]);
	let level1Id = $state('');

	let submitting = $state(false);
	let result: { ok: true; reportId: string; status: string } | { ok: false; error: string } | null =
		$state(null);

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
		const { data } = await supabase
			.from('admin_level1')
			.select('id, name, country_id, countries!inner(url_slug)')
			.eq('countries.url_slug', 'Nig')
			.order('name');
		levels = (data ?? []).map((r: any) => ({ id: r.id, name: r.name }));
		if (levels.length > 0) level1Id = levels[0].id;

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				deviceLat = pos.coords.latitude;
				deviceLng = pos.coords.longitude;
				accuracyM = pos.coords.accuracy;
				pinLat = deviceLat;
				pinLng = deviceLng;
				locating = false;
				initMap();
			},
			(err) => {
				locationError = err.message;
				locating = false;
				// Fall back to a Lagos-ish default so the map/form are still usable.
				pinLat = 6.5244;
				pinLng = 3.3792;
				initMap();
			},
			{ enableHighAccuracy: true, timeout: 10000 },
		);
	});

	function initMap() {
		if (!mapContainer || pinLat === null || pinLng === null) return;
		map = new MlMap({
			container: mapContainer,
			style: OSM_STYLE,
			center: [pinLng, pinLat],
			zoom: 16,
		});
		marker = new Marker({ draggable: true })
			.setLngLat([pinLng, pinLat])
			.addTo(map);
		marker.on('dragend', () => {
			const { lat, lng } = marker.getLngLat();
			pinLat = lat;
			pinLng = lng;
		});
	}

	onDestroy(() => {
		map?.remove();
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (deviceLat === null || deviceLng === null || accuracyM === null) {
			result = { ok: false, error: 'Location not available — allow location access and retry.' };
			return;
		}
		if (pinLat === null || pinLng === null) {
			result = { ok: false, error: 'Drop a pin on the map first.' };
			return;
		}
		submitting = true;
		result = null;
		try {
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/reports`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
				},
				body: JSON.stringify({
					country_slug: 'Nig',
					category,
					severity,
					description: description || undefined,
					level1_id: level1Id,
					pin_lat: pinLat,
					pin_lng: pinLng,
					device_lat: deviceLat,
					device_lng: deviceLng,
					accuracy_m: accuracyM,
					session_uuid: getSessionUuid(),
				}),
			});
			const body = await res.json();
			if (!res.ok) {
				result = { ok: false, error: body.error ?? `request failed (${res.status})` };
			} else {
				result = { ok: true, reportId: body.report_id, status: body.status };
			}
		} catch (err) {
			result = { ok: false, error: (err as Error).message };
		} finally {
			submitting = false;
		}
	}
</script>

<h1>Report it — help your LGA plan repairs</h1>
<p>No signup. Your location is only used to confirm you're at the issue — nothing about you is stored.</p>

{#if locating}
	<p>Getting your location…</p>
{:else}
	{#if locationError}
		<p role="alert">Couldn't get your precise location ({locationError}). Drag the pin to the right spot.</p>
	{/if}

	<div bind:this={mapContainer} style="width: 100%; height: 320px; margin-bottom: 1rem;"></div>
	<p>Drag the pin to the exact spot. Accuracy: {accuracyM ? Math.round(accuracyM) : '—'} m</p>

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
			Category
			<select bind:value={category} required>
				{#each REPORT_CATEGORIES as c (c.value)}
					<option value={c.value}>{c.label}</option>
				{/each}
			</select>
		</label>

		<label>
			Severity
			<select bind:value={severity} required>
				{#each REPORT_SEVERITIES as s (s.value)}
					<option value={s.value}>{s.label}</option>
				{/each}
			</select>
		</label>

		<label>
			Description (optional)
			<textarea bind:value={description} maxlength="2000" rows="3"></textarea>
		</label>

		<button type="submit" disabled={submitting}>
			{submitting ? 'Submitting…' : 'Submit report'}
		</button>
	</form>

	{#if result}
		{#if result.ok}
			<p role="status">
				Submitted. Status: <strong>{result.status}</strong>
				{#if result.status === 'pending'}
					(this category is reviewed by a moderator before it appears publicly)
				{/if}
			</p>
		{:else}
			<p role="alert">Error: {result.error}</p>
		{/if}
	{/if}
{/if}
