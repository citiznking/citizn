<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { Map as MlMap, Marker, type StyleSpecification } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { supabase } from '$lib/supabase';
	import { getSessionUuid } from '$lib/session';
	import { CATEGORIES, SENSITIVE_CATEGORIES, getCategory } from '$lib/design/categories';
	import { SEVERITY_ORDER, SEVERITY } from '$lib/design/severity';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import Lock from 'lucide-svelte/icons/lock';
	import X from 'lucide-svelte/icons/x';
	import Check from 'lucide-svelte/icons/check';
	import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
	import Camera from 'lucide-svelte/icons/camera';
	import Navigation from 'lucide-svelte/icons/navigation';
	import ArrowRight from 'lucide-svelte/icons/arrow-right';
	import CheckCircle2 from 'lucide-svelte/icons/check-circle-2';
	import Share2 from 'lucide-svelte/icons/share-2';

	const campaignSlug = page.url.searchParams.get('campaign');
	const STEP_COUNT = 5;
	const MAX_VIDEO_DURATION_S = 140;
	const MAX_FILE_SIZE = 83886080; // 80MB

	let step = $state(0);
	let category: string | null = $state(null);
	let severity: string | null = $state(null);
	let description = $state('');
	let xHandle = $state('');
	let riskAcknowledged = $state(false);
	let showRiskModal = $state(false);
	let mediaFile: File | null = $state(null);

	let isSensitive = $derived(category ? SENSITIVE_CATEGORIES.has(category) : false);
	let catData = $derived(category ? getCategory(category) : null);

	let levels: { id: string; name: string }[] = $state([]);
	let level1Id = $state('');

	let deviceLat: number | null = $state(null);
	let deviceLng: number | null = $state(null);
	let accuracyM: number | null = $state(null);
	let locating = $state(true);
	let locationError = $state('');
	let locationPermissionDenied = $state(false);
	let pinLat: number | null = $state(null);
	let pinLng: number | null = $state(null);

	let mapContainer: HTMLDivElement | undefined = $state();
	let map: MlMap | undefined;
	let marker: Marker | undefined;

	let submitting = $state(false);
	let mediaUploading = $state(false);
	let mediaResult: { ok: true } | { ok: false; error: string } | null = $state(null);
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

	supabase
		.from('admin_level1')
		.select('id, name, countries!inner(url_slug)')
		.eq('countries.url_slug', 'Nig')
		.order('name')
		.then(({ data }) => {
			levels = (data ?? []).map((r: any) => ({ id: r.id, name: r.name }));
			if (levels.length > 0) level1Id = levels[0].id;
		});

	function requestLocation() {
		locating = true;
		locationError = '';
		locationPermissionDenied = false;
		navigator.geolocation?.getCurrentPosition(
			(pos) => {
				deviceLat = pos.coords.latitude;
				deviceLng = pos.coords.longitude;
				accuracyM = pos.coords.accuracy;
				pinLat = deviceLat;
				pinLng = deviceLng;
				locating = false;
			},
			(err) => {
				locationError = err.message;
				locationPermissionDenied = err.code === err.PERMISSION_DENIED;
				locating = false;
				// A dropped pin still needs somewhere to start — this is
				// only ever a map center, never used as the device fix
				// (deviceLat/deviceLng stay null), so it can't bypass the
				// geofence check in submit().
				if (pinLat === null) {
					pinLat = 6.5244;
					pinLng = 3.3792;
				}
			},
			{ enableHighAccuracy: true, timeout: 10000 },
		);
	}
	requestLocation();

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

	$effect(() => {
		if (step === 2 && mapContainer && !map && pinLat !== null && pinLng !== null) {
			map = new MlMap({ container: mapContainer, style: OSM_STYLE, center: [pinLng, pinLat], zoom: 16 });
			marker = new Marker({ draggable: true }).setLngLat([pinLng, pinLat]).addTo(map);
			marker.on('dragend', () => {
				const { lat, lng } = marker!.getLngLat();
				pinLat = lat;
				pinLng = lng;
			});
		}
	});

	onDestroy(() => map?.remove());

	function selectCategory(id: string) {
		category = id;
		if (SENSITIVE_CATEGORIES.has(id)) {
			showRiskModal = true;
		} else {
			step = 1;
		}
	}

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

	async function onFilePicked(file: File) {
		if (!['image/jpeg', 'image/webp', 'video/mp4'].includes(file.type)) {
			mediaResult = { ok: false, error: 'Only JPEG/WEBP photos or MP4 video are accepted.' };
			return;
		}
		if (file.size > MAX_FILE_SIZE) {
			mediaResult = { ok: false, error: 'File is too large (max 80MB).' };
			return;
		}
		if (file.type === 'video/mp4') {
			const dur = await videoDuration(file);
			if (dur > MAX_VIDEO_DURATION_S) {
				mediaResult = { ok: false, error: `Video is ${Math.round(dur)}s — must be ${MAX_VIDEO_DURATION_S}s or shorter.` };
				return;
			}
		}
		mediaResult = null;
		mediaFile = file;
	}

	async function uploadMedia(reportId: string, file: File) {
		mediaUploading = true;
		try {
			let durationSeconds: number | undefined;
			if (file.type === 'video/mp4') durationSeconds = await videoDuration(file);

			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/media-upload`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY },
				body: JSON.stringify({ report_id: reportId, mime_type: file.type, file_size: file.size, duration_seconds: durationSeconds }),
			});
			const body = await res.json();
			if (!res.ok) {
				mediaResult = { ok: false, error: body.error ?? `request failed (${res.status})` };
				return;
			}
			const { error: uploadErr } = await supabase.storage
				.from('media-quarantine')
				.uploadToSignedUrl(body.storage_path, body.token, file, { contentType: file.type });
			mediaResult = uploadErr ? { ok: false, error: uploadErr.message } : { ok: true };
		} catch (err) {
			mediaResult = { ok: false, error: (err as Error).message };
		} finally {
			mediaUploading = false;
		}
	}

	async function submit() {
		if (deviceLat === null || deviceLng === null || accuracyM === null || pinLat === null || pinLng === null) {
			result = { ok: false, error: 'Location not available — allow location access and retry.' };
			return;
		}
		submitting = true;
		result = null;
		try {
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/reports`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY },
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
				return;
			}
			result = {
				ok: true,
				reportId: body.report_id,
				status: body.status,
				claimToken: body.claim_token,
				campaignProgress: body.campaign_progress,
				wonImmediately: body.won_immediately,
			};
			if (mediaFile) await uploadMedia(body.report_id, mediaFile);
		} catch (err) {
			result = { ok: false, error: (err as Error).message };
		} finally {
			submitting = false;
		}
	}

	function goBack() {
		if (step === 0) {
			history.back();
		} else {
			step -= 1;
		}
	}
</script>

{#if result?.ok}
	<div class="flex flex-col items-center justify-center h-full px-6 text-center">
		<div class="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
			<CheckCircle2 size={32} class="text-emerald-600" />
		</div>
		<h2 class="text-2xl font-semibold mb-2 font-display">Report on record</h2>
		<p class="text-sm text-muted-foreground mb-6 leading-relaxed">
			Status: <strong>{result.status}</strong>
			{#if result.status === 'pending'}— reviewed by a moderator before it appears publicly{/if}
		</p>

		{#if result.campaignProgress && !result.claimToken}
			{@const p = result.campaignProgress}
			<div class="w-full border border-border rounded-2xl p-4 mb-4 text-left">
				<p class="text-sm mb-1.5">{p.submission_count} of {p.min_submissions} submissions toward this campaign's reward.</p>
				<div class="h-2 bg-muted rounded-full overflow-hidden">
					<div class="h-full bg-primary rounded-full" style="width: {Math.min(100, (p.submission_count / p.min_submissions) * 100)}%"></div>
				</div>
			</div>
		{/if}

		{#if result.claimToken}
			<div class="w-full bg-card border border-border rounded-2xl p-5 mb-4 text-left">
				<p class="text-xs text-muted-foreground mb-1.5">
					{result.wonImmediately ? "You've qualified — reward slot confirmed" : "You're entered in the draw"}
				</p>
				<p class="text-xs font-semibold text-foreground mb-2">Save this code — it's the only way to claim your reward.</p>
				<code class="block text-sm font-code break-all select-all bg-muted rounded-lg px-3 py-2">{result.claimToken}</code>
				<p class="text-xs text-muted-foreground mt-2">We can't recover this if it's lost — we keep no link back to you or this device.</p>
			</div>
		{/if}

		<div class="w-full border border-dashed border-border rounded-2xl p-4 mb-6 text-left">
			{#if mediaFile}
				{#if mediaUploading}
					<p class="text-sm text-muted-foreground">Uploading media…</p>
				{:else if mediaResult?.ok}
					<p class="text-sm text-emerald-700 flex items-center gap-1.5"><Check size={14} /> Media uploaded — it'll appear once it clears review.</p>
				{:else if mediaResult && !mediaResult.ok}
					<p class="text-sm text-destructive">{mediaResult.error}</p>
				{/if}
			{:else}
				<label class="flex items-center gap-3 cursor-pointer">
					<div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
						<Camera size={18} class="text-primary" />
					</div>
					<div>
						<p class="text-sm font-semibold">Add a photo or video</p>
						<p class="text-xs text-muted-foreground">Optional, up to {MAX_VIDEO_DURATION_S}s / 80MB</p>
					</div>
					<input
						type="file"
						accept="image/jpeg,image/webp,video/mp4"
						class="hidden"
						onchange={(e) => {
							const file = (e.currentTarget as HTMLInputElement).files?.[0];
							if (file) uploadMedia(result && result.ok ? result.reportId : '', file).then(() => (mediaFile = file));
						}}
					/>
				</label>
			{/if}
		</div>

		<div class="w-full flex gap-3">
			<button class="flex-1 py-3.5 rounded-2xl border border-border text-sm font-medium flex items-center justify-center gap-2">
				<Share2 size={15} /> Share
			</button>
			<a href="/Nig" class="flex-1 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
				Back to feed
			</a>
		</div>
	</div>
{:else}
	<div class="flex flex-col h-full relative">
		<div class="px-4 py-3 flex items-center gap-3 border-b border-border shrink-0 bg-background">
			<button onclick={goBack} class="p-1.5 -ml-1 rounded-xl text-foreground/60 active:bg-muted transition-colors" aria-label="Back">
				<ChevronLeft size={20} />
			</button>
			<div class="flex-1 flex gap-1.5">
				{#each Array(STEP_COUNT) as _, i (i)}
					<div class="flex-1 h-1 rounded-full transition-all duration-300 {i <= step ? 'bg-primary' : 'bg-muted'}"></div>
				{/each}
			</div>
			<span class="text-xs text-muted-foreground w-8 text-right font-code">{step + 1}/{STEP_COUNT}</span>
		</div>

		{#if isSensitive}
			<div class="mx-4 mt-3 px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2 shrink-0">
				<Lock size={13} class="text-blue-600 shrink-0" />
				<p class="text-xs text-blue-700 font-medium">Sensitive category — handled with care and reviewed before publication</p>
			</div>
		{/if}

		<div class="flex-1 overflow-y-auto scrollbar-none">
			{#if step === 0}
				<div class="p-4">
					<h2 class="text-2xl font-semibold mb-1 font-display">What are you reporting?</h2>
					<p class="text-sm text-muted-foreground mb-5">Select the type of issue you have found.</p>
					<div class="grid grid-cols-2 gap-3">
						{#each CATEGORIES as cat (cat.id)}
							{@const Icon = cat.icon}
							<button
								onclick={() => selectCategory(cat.id)}
								class="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all active:scale-[0.97] {category === cat.id
									? 'border-primary bg-primary/5'
									: 'border-border bg-card'}"
							>
								{#if cat.sensitive}
									<span class="absolute top-2 right-2 text-[8px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded tracking-wide uppercase">Sensitive</span>
								{/if}
								<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background: {cat.bg};">
									<Icon size={22} color={cat.color} />
								</div>
								<span class="text-xs font-semibold text-center leading-tight">{cat.label}</span>
							</button>
						{/each}
					</div>
				</div>
			{:else if step === 1}
				<div class="p-4">
					<h2 class="text-2xl font-semibold mb-1 font-display">How severe is this?</h2>
					<p class="text-sm text-muted-foreground mb-5">Your honest assessment helps prioritise responses.</p>
					<div class="flex flex-col gap-3">
						{#each SEVERITY_ORDER as level (level)}
							{@const s = SEVERITY[level]}
							<button
								onclick={() => {
									severity = level;
									step = 2;
								}}
								class="flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] {severity === level
									? 'border-primary bg-primary/5'
									: 'border-border bg-card'}"
							>
								<div class="w-4 h-4 rounded-full shrink-0 {s.dot}"></div>
								<div class="flex-1">
									<p class="font-semibold text-sm {s.textColor}">{s.label}</p>
									<p class="text-xs text-muted-foreground">{s.desc}</p>
								</div>
								{#if severity === level}<Check size={16} class="text-primary shrink-0" />{/if}
							</button>
						{/each}
					</div>
				</div>
			{:else if step === 2}
				<div class="p-4">
					<h2 class="text-2xl font-semibold mb-1 font-display">Where is this?</h2>
					<p class="text-sm text-muted-foreground mb-4">
						{#if locating}
							Getting your location…
						{:else if deviceLat !== null}
							Drag the pin to the exact spot. Accuracy: {Math.round(accuracyM ?? 0)}m
						{/if}
					</p>

					{#if !locating && deviceLat === null}
						<div class="rounded-xl bg-amber-50 border border-amber-200 p-3.5 mb-4">
							<p class="text-xs text-amber-700 mb-2">
								{#if locationPermissionDenied}
									Location access is blocked for this site. On iPhone: tap the <strong>"aA"</strong> icon in the address
									bar → <strong>Website Settings</strong> → <strong>Location</strong> → Allow, or check
									<strong>Settings → Safari → Location</strong>. On Android: check your browser's site permissions.
									Then try again.
								{:else}
									Couldn't get your location ({locationError}). A live location fix is required to submit — it's
									what proves you're actually at the spot you're reporting.
								{/if}
							</p>
							<button onclick={requestLocation} class="text-xs font-semibold text-amber-800 underline">Try again</button>
						</div>
					{/if}

					<label class="block text-sm font-medium text-foreground mb-2">
						State
						<select bind:value={level1Id} class="w-full mt-1 bg-input-background border border-border rounded-xl px-4 py-3 text-sm">
							{#each levels as l (l.id)}
								<option value={l.id}>{l.name}</option>
							{/each}
						</select>
					</label>

					{#if !locating}
						<div bind:this={mapContainer} class="rounded-2xl overflow-hidden border border-border mb-4 h-64"></div>
					{/if}

					<button
						onclick={() => (step = 3)}
						disabled={locating || deviceLat === null}
						class="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
					>
						Confirm location <ArrowRight size={16} />
					</button>
				</div>
			{:else if step === 3}
				<div class="p-4">
					<h2 class="text-2xl font-semibold mb-1 font-display">Add evidence</h2>
					<p class="text-sm text-muted-foreground mb-5">Photo, description, or both. All optional but helpful.</p>

					<label
						class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 mb-4 transition-all cursor-pointer {mediaFile
							? 'border-emerald-400 bg-emerald-50'
							: 'border-dashed border-border bg-card'}"
					>
						{#if mediaFile}
							<Check size={20} class="text-emerald-600 shrink-0" />
							<div class="text-left">
								<p class="text-sm font-semibold text-emerald-700">{mediaFile.name}</p>
								<p class="text-xs text-emerald-600">Tap to replace</p>
							</div>
						{:else}
							<div class="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
								<Camera size={18} class="text-primary" />
							</div>
							<div class="text-left">
								<p class="text-sm font-semibold text-foreground">Take a photo or video</p>
								<p class="text-xs text-muted-foreground">Strong evidence speeds up response</p>
							</div>
						{/if}
						<input
							type="file"
							accept="image/jpeg,image/webp,video/mp4"
							class="hidden"
							onchange={(e) => {
								const file = (e.currentTarget as HTMLInputElement).files?.[0];
								if (file) onFilePicked(file);
							}}
						/>
					</label>
					{#if mediaResult && !mediaResult.ok}
						<p class="text-xs text-destructive mb-4">{mediaResult.error}</p>
					{/if}

					<label for="desc" class="block text-sm font-medium text-foreground mb-2">Describe what you see</label>
					<textarea
						id="desc"
						bind:value={description}
						maxlength="2000"
						rows="4"
						placeholder="e.g. The pothole has been here for 3 weeks, about 40cm wide near the bus stop..."
						class="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary resize-none mb-4"
					></textarea>

					<label for="xhandle" class="block text-sm font-medium text-foreground mb-1">
						Tag your X handle <span class="text-muted-foreground font-normal">(optional)</span>
					</label>
					<div class="flex items-center gap-2 bg-input-background border border-border rounded-xl px-4 py-3 mb-1">
						<span class="text-muted-foreground text-sm">@</span>
						<input id="xhandle" type="text" bind:value={xHandle} maxlength="16" placeholder="yourhandle" class="flex-1 bg-transparent text-sm outline-none" />
					</div>

					{#if isSensitive && xHandle}
						<div class="rounded-xl bg-amber-50 border border-amber-200 p-3.5 mb-4 mt-2">
							<p class="text-xs text-amber-700 flex items-start gap-1.5 mb-2">
								<AlertTriangle size={13} class="shrink-0 mt-0.5" />
								Tagging your handle here will publicly link that account to this specific report and location once it's posted. If it's tied to your real identity, this could expose you to retaliation.
							</p>
							<label class="flex items-center gap-2 text-xs text-amber-700">
								<input type="checkbox" bind:checked={riskAcknowledged} />
								I understand and want to tag my handle anyway
							</label>
						</div>
					{:else if !xHandle}
						<p class="text-xs text-muted-foreground mb-4">Leave blank to stay fully anonymous.</p>
					{/if}

					<button
						onclick={() => (step = 4)}
						disabled={isSensitive && !!xHandle && !riskAcknowledged}
						class="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
					>
						Review report <ArrowRight size={16} />
					</button>
				</div>
			{:else if step === 4}
				<div class="p-4">
					<h2 class="text-2xl font-semibold mb-1 font-display">Review & submit</h2>
					<p class="text-sm text-muted-foreground mb-5">Check the details before your report goes on record.</p>

					<div class="bg-card border border-border rounded-2xl p-4 mb-4 space-y-3">
						<div class="flex items-center gap-3">
							{#if catData}
								{@const Icon = catData.icon}
								<div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background: {catData.bg};">
									<Icon size={18} color={catData.color} />
								</div>
								<div>
									<p class="text-sm font-semibold">{catData.label}</p>
									{#if catData.sensitive}
										<span class="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">Sensitive category</span>
									{/if}
								</div>
							{/if}
						</div>
						{#if severity}
							<div class="flex items-center justify-between border-t border-border pt-3">
								<span class="text-xs text-muted-foreground">Severity</span>
								<span class="text-sm font-semibold {SEVERITY[severity].textColor}">{SEVERITY[severity].label}</span>
							</div>
						{/if}
						{#if description}
							<div class="border-t border-border pt-3">
								<p class="text-xs text-muted-foreground mb-1">Description</p>
								<p class="text-sm text-foreground leading-snug">{description}</p>
							</div>
						{/if}
						<div class="flex items-center gap-1.5 border-t border-border pt-3">
							<Lock size={12} class="text-primary" />
							<p class="text-xs text-muted-foreground">This report will be filed anonymously. No account, no tracking.</p>
						</div>
					</div>

					{#if result && !result.ok}
						<p class="text-sm text-destructive mb-1">{result.error}</p>
						{#if deviceLat === null}
							<button onclick={requestLocation} class="text-sm font-semibold text-primary underline mb-3">Try getting location again</button>
						{/if}
					{/if}

					<button
						onclick={submit}
						disabled={submitting || deviceLat === null}
						class="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
					>
						{submitting ? 'Submitting…' : 'Submit report'}
					</button>
					<p class="text-center text-xs text-muted-foreground mt-3">Your report will be reviewed and published within 24 hours.</p>
				</div>
			{/if}
		</div>

		{#if showRiskModal}
			<div class="absolute inset-0 bg-[#060D1E]/80 backdrop-blur-sm z-50 flex items-end p-4">
				<div class="w-full bg-card rounded-2xl overflow-hidden shadow-2xl">
					<div class="bg-[#0F2151] px-5 py-4 flex items-start gap-3">
						<Lock size={18} class="text-blue-300 mt-0.5 shrink-0" />
						<div>
							<h3 class="text-white font-semibold text-base mb-0.5">Your anonymity is protected</h3>
							<p class="text-blue-300 text-xs leading-relaxed">Sensitive report category — read before continuing.</p>
						</div>
						<button
							onclick={() => {
								showRiskModal = false;
								category = null;
							}}
							class="ml-auto text-blue-300 active:text-white transition-colors"
							aria-label="Close"
						>
							<X size={18} />
						</button>
					</div>
					<div class="p-5 space-y-4">
						<p class="text-sm text-foreground leading-relaxed">
							This platform stores <strong>no identity data</strong> by default. No account is required or ever created.
						</p>
						<div class="bg-amber-50 rounded-xl p-4 border border-amber-200">
							<div class="flex items-center gap-2 mb-2">
								<AlertTriangle size={14} class="text-amber-600" />
								<span class="text-xs font-semibold text-amber-700">If you add your identity (optional)</span>
							</div>
							<ul class="text-xs text-amber-700 space-y-1.5 ml-1">
								<li class="flex items-start gap-1.5"><span class="mt-0.5 shrink-0">·</span> Your handle will be visible on the public record</li>
								<li class="flex items-start gap-1.5"><span class="mt-0.5 shrink-0">·</span> This cannot be reversed after submission</li>
								<li class="flex items-start gap-1.5"><span class="mt-0.5 shrink-0">·</span> Consider your safety before self-identifying</li>
							</ul>
						</div>
						<p class="text-xs text-muted-foreground leading-relaxed">All sensitive reports are reviewed by the Citizn moderation team before any publication.</p>
					</div>
					<div class="px-5 pb-5 flex gap-3">
						<button
							onclick={() => {
								showRiskModal = false;
								category = null;
							}}
							class="flex-1 py-3.5 rounded-xl border border-border text-sm font-medium text-muted-foreground active:bg-muted transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={() => {
								showRiskModal = false;
								step = 1;
							}}
							class="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:opacity-90 transition-opacity"
						>
							I understand
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
