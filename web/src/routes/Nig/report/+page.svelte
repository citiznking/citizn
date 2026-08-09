<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { Map as MlMap, Marker, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { supabase } from '$lib/supabase';
	import { getSessionUuid } from '$lib/session';
	import { REPORT_CATEGORIES, REPORT_SEVERITIES } from '$lib/reports';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';

	const campaignSlug = page.url.searchParams.get('campaign');

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
	let xHandle = $state('');
	let levels: { id: string; name: string }[] = $state([]);
	let level1Id = $state('');

	const SENSITIVE_CATEGORIES = new Set(['violence', 'police_issue']);
	let isSensitiveCategory = $derived(SENSITIVE_CATEGORIES.has(category));
	let riskAcknowledged = $state(false);
	$effect(() => {
		if (!isSensitiveCategory) riskAcknowledged = false;
	});

	let submitting = $state(false);
	let result:
		| {
				ok: true;
				reportId: string;
				status: string;
				claimToken?: string;
				campaignProgress?: { submission_count: number; min_submissions: number };
				wonImmediately?: boolean;
		  }
		| { ok: false; error: string }
		| null = $state(null);

	const MAX_VIDEO_DURATION_S = 140;
	const MAX_FILE_SIZE = 83886080; // 80MB
	let mediaUploading = $state(false);
	let mediaResult: { ok: true } | { ok: false; error: string } | null = $state(null);
	let mediaInput: HTMLInputElement | undefined = $state();

	function videoDuration(file: File): Promise<number> {
		return new Promise((resolve, reject) => {
			const el = document.createElement('video');
			el.preload = 'metadata';
			el.onloadedmetadata = () => {
				URL.revokeObjectURL(el.src);
				resolve(el.duration);
			};
			el.onerror = () => reject(new Error('could not read video metadata'));
			el.src = URL.createObjectURL(file);
		});
	}

	async function uploadMedia(reportId: string, file: File) {
		mediaUploading = true;
		mediaResult = null;
		try {
			if (!['image/jpeg', 'image/webp', 'video/mp4'].includes(file.type)) {
				mediaResult = { ok: false, error: 'Only JPEG/WEBP photos or MP4 video are accepted.' };
				return;
			}
			if (file.size > MAX_FILE_SIZE) {
				mediaResult = { ok: false, error: 'File is too large (max 80MB).' };
				return;
			}
			let durationSeconds: number | undefined;
			if (file.type === 'video/mp4') {
				durationSeconds = await videoDuration(file);
				if (durationSeconds > MAX_VIDEO_DURATION_S) {
					mediaResult = {
						ok: false,
						error: `Video is ${Math.round(durationSeconds)}s — must be ${MAX_VIDEO_DURATION_S}s or shorter.`,
					};
					return;
				}
			}

			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/media-upload`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
				},
				body: JSON.stringify({
					report_id: reportId,
					mime_type: file.type,
					file_size: file.size,
					duration_seconds: durationSeconds,
				}),
			});
			const body = await res.json();
			if (!res.ok) {
				mediaResult = { ok: false, error: body.error ?? `request failed (${res.status})` };
				return;
			}

			const { error: uploadErr } = await supabase.storage
				.from('media-quarantine')
				.uploadToSignedUrl(body.storage_path, body.token, file, { contentType: file.type });
			if (uploadErr) {
				mediaResult = { ok: false, error: uploadErr.message };
				return;
			}

			mediaResult = { ok: true };
		} catch (err) {
			mediaResult = { ok: false, error: (err as Error).message };
		} finally {
			mediaUploading = false;
		}
	}

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
		if (isSensitiveCategory && xHandle && !riskAcknowledged) {
			result = { ok: false, error: 'Check the acknowledgment box below, or clear the X handle field, before submitting.' };
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
					campaign_slug: campaignSlug || undefined,
					reporter_x_handle: xHandle || undefined,
				}),
			});
			const body = await res.json();
			if (!res.ok) {
				result = { ok: false, error: body.error ?? `request failed (${res.status})` };
			} else {
				result = {
					ok: true,
					reportId: body.report_id,
					status: body.status,
					claimToken: body.claim_token,
					campaignProgress: body.campaign_progress,
					wonImmediately: body.won_immediately,
				};
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
{#if campaignSlug}
	<p>Reporting as part of the <strong>{campaignSlug}</strong> campaign.</p>
{/if}

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

		<label>
			Your X handle (optional)
			<input type="text" bind:value={xHandle} maxlength="16" placeholder="e.g. yourhandle" />
		</label>
		<p><small>
			If this report gets shared on Citizn's X account, we'll tag you so your network can see and
			repost it. Leave blank to stay anonymous — this is never required.
		</small></p>

		{#if isSensitiveCategory && xHandle}
			<div role="alert" style="border: 2px solid; padding: 1rem;">
				<p>
					<strong>This is a {category === 'police_issue' ? 'police/security-service' : 'violence/insecurity'} report.</strong>
					Tagging your X handle here will publicly link that account to this specific report and
					its location once it's posted. If your X account is tied to your real identity, this
					could expose you to retaliation. If it's a pseudonymous/anonymous account, that risk is
					lower — but the report content and location will still be publicly attached to whatever
					that account is or becomes linked to later.
				</p>
				<label>
					<input type="checkbox" bind:checked={riskAcknowledged} />
					I understand this and want to tag my X handle anyway
				</label>
			</div>
		{/if}

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
			{#if result.campaignProgress && !result.claimToken}
				{@const p = result.campaignProgress}
				<div style="border: 1px solid; padding: 1rem; margin-top: 1rem;">
					<p style="margin: 0 0 0.5rem;">
						{p.submission_count} of {p.min_submissions} submissions toward this campaign's reward.
					</p>
					<div style="height: 6px; background: rgba(128,128,128,0.25); border-radius: 3px; overflow: hidden;">
						<div style="height: 100%; width: {Math.min(100, (p.submission_count / p.min_submissions) * 100)}%; background: currentColor;"></div>
					</div>
					<p style="margin: 0.5rem 0 0;"><small>
						{p.min_submissions - p.submission_count} more report{p.min_submissions - p.submission_count === 1 ? '' : 's'} under this campaign to qualify.
					</small></p>
				</div>
			{/if}

			{#if result.claimToken}
				<div role="alert" style="border: 2px solid; padding: 1rem; margin-top: 1rem;">
					{#if result.wonImmediately}
						<p><strong>You've qualified and a reward slot is confirmed.</strong></p>
						<p>Save this code, then visit <a href="/claim">/claim</a> to redeem it.</p>
					{:else}
						<p><strong>You're entered — save this code.</strong></p>
						<p>Winners are drawn at random once the campaign closes. Check back at <a href="/claim">/claim</a> with this code.</p>
					{/if}
					<p>We don't keep any way to link it back to you or this device, so we can't recover it if it's lost.</p>
					<code style="font-size: 1.1rem; user-select: all;">{result.claimToken}</code>
				</div>
			{/if}

			{@const reportId = result.reportId}
			<div style="margin-top: 1rem;">
				<label>
					Add a photo or short video (optional, up to {MAX_VIDEO_DURATION_S}s / 80MB)
					<input
						bind:this={mediaInput}
						type="file"
						accept="image/jpeg,image/webp,video/mp4"
						disabled={mediaUploading}
						onchange={(e) => {
							const file = (e.currentTarget as HTMLInputElement).files?.[0];
							if (file) uploadMedia(reportId, file);
						}}
					/>
				</label>
				{#if mediaUploading}
					<p>Uploading…</p>
				{:else if mediaResult}
					{#if mediaResult.ok}
						<p role="status">Uploaded — it'll appear once it clears review.</p>
					{:else}
						<p role="alert">{mediaResult.error}</p>
					{/if}
				{/if}
			</div>
		{:else}
			<p role="alert">Error: {result.error}</p>
		{/if}
	{/if}
{/if}
