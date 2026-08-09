<script lang="ts">
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import { getSessionUuid } from '$lib/session';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import CircleCheck from 'lucide-svelte/icons/circle-check';
	import FileImage from 'lucide-svelte/icons/file-image';
	import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';

	const puId = page.url.searchParams.get('pu');

	interface Pu {
		id: string;
		name: string;
		official_pu_code: string;
	}
	interface Party {
		code: string;
		name: string;
	}

	let pu: Pu | null = $state(null);
	let mode: 'menu' | 'checkin' | 'results' | 'incident' = $state('menu');

	let deviceLat: number | null = $state(null);
	let deviceLng: number | null = $state(null);
	let accuracyM: number | null = $state(null);
	let locating = $state(true);

	let submitting = $state(false);
	let outcome: { ok: true; message: string } | { ok: false; error: string } | null = $state(null);

	let raceType = $state('pres');
	let parties: Party[] = $state([]);
	let votes: Record<string, number> = $state({});

	let incidentCategory = $state('violence');
	let incidentNote = $state('');

	if (puId) {
		supabase
			.from('polling_units')
			.select('id, name, official_pu_code')
			.eq('id', puId)
			.maybeSingle()
			.then(({ data }) => (pu = data as Pu | null));
	}

	navigator.geolocation?.getCurrentPosition(
		(pos) => {
			deviceLat = pos.coords.latitude;
			deviceLng = pos.coords.longitude;
			accuracyM = pos.coords.accuracy;
			locating = false;
		},
		() => {
			locating = false;
		},
		{ enableHighAccuracy: true, timeout: 10000 },
	);

	function loadParties() {
		supabase
			.from('parties')
			.select('code, name')
			.eq('race_type', raceType)
			.eq('active', true)
			.then(({ data }) => {
				parties = (data ?? []) as Party[];
				votes = {};
			});
	}

	async function doCheckin() {
		submitting = true;
		outcome = null;
		try {
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/election-checkin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY },
				body: JSON.stringify({
					election_slug: '2027election',
					pu_id: puId,
					lat: deviceLat,
					lng: deviceLng,
					accuracy_m: accuracyM,
					captured_at: new Date().toISOString(),
					session_uuid: getSessionUuid(),
				}),
			});
			const body = await res.json();
			outcome = res.ok ? { ok: true, message: 'Check-in recorded. Thank you.' } : { ok: false, error: body.error };
		} catch (err) {
			outcome = { ok: false, error: (err as Error).message };
		} finally {
			submitting = false;
		}
	}

	async function doResults() {
		submitting = true;
		outcome = null;
		try {
			const entries = Object.entries(votes)
				.filter(([, v]) => v !== undefined && v !== null)
				.map(([party_code, v]) => ({ party_code, votes: v }));
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/election-results`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY },
				body: JSON.stringify({
					election_slug: '2027election',
					pu_id: puId,
					race_type: raceType,
					entries,
					lat: deviceLat,
					lng: deviceLng,
					accuracy_m: accuracyM,
					captured_at: new Date().toISOString(),
					session_uuid: getSessionUuid(),
				}),
			});
			const body = await res.json();
			outcome = res.ok
				? { ok: true, message: `Result recorded — ${body.corroboration_count} matching submission${body.corroboration_count === 1 ? '' : 's'} so far.` }
				: { ok: false, error: body.error };
		} catch (err) {
			outcome = { ok: false, error: (err as Error).message };
		} finally {
			submitting = false;
		}
	}

	async function doIncident() {
		submitting = true;
		outcome = null;
		try {
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/election-incident`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY },
				body: JSON.stringify({
					election_slug: '2027election',
					pu_id: puId,
					category: incidentCategory,
					note: incidentNote || undefined,
					lat: deviceLat,
					lng: deviceLng,
					accuracy_m: accuracyM,
					captured_at: new Date().toISOString(),
					session_uuid: getSessionUuid(),
				}),
			});
			const body = await res.json();
			outcome = res.ok ? { ok: true, message: 'Incident recorded — a moderator will review it.' } : { ok: false, error: body.error };
		} catch (err) {
			outcome = { ok: false, error: (err as Error).message };
		} finally {
			submitting = false;
		}
	}
</script>

<div class="p-4">
	{#if !puId}
		<p class="text-sm text-destructive">No polling unit selected. <a href="/Nig/2027election" class="text-primary underline">Find one first</a>.</p>
	{:else}
		<div class="flex items-center gap-2 mb-1">
			{#if mode !== 'menu'}
				<button onclick={() => (mode = 'menu')} class="p-1 -ml-1 rounded-lg text-foreground/60" aria-label="Back">
					<ChevronLeft size={18} />
				</button>
			{/if}
			<h1 class="text-xl font-semibold font-display">{pu?.name ?? 'Loading…'}</h1>
		</div>
		<p class="text-xs text-muted-foreground font-code mb-5">{pu?.official_pu_code ?? ''}</p>

		{#if locating}
			<p class="text-sm text-muted-foreground">Getting your location…</p>
		{:else if outcome?.ok}
			<div class="flex flex-col items-center text-center py-10">
				<CircleCheck size={40} class="text-emerald-600 mb-3" />
				<p class="text-sm text-foreground">{outcome.message}</p>
				<button onclick={() => { outcome = null; mode = 'menu'; }} class="mt-4 text-sm text-primary font-medium">Report something else</button>
			</div>
		{:else if mode === 'menu'}
			<div class="space-y-3">
				<button onclick={doCheckin} disabled={submitting} class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-border bg-card text-left disabled:opacity-50">
					<CircleCheck size={22} class="text-primary shrink-0" />
					<div>
						<p class="text-sm font-semibold">INEC is here</p>
						<p class="text-xs text-muted-foreground">One tap — timestamped arrival check-in</p>
					</div>
				</button>
				<button onclick={() => { mode = 'results'; loadParties(); }} class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-border bg-card text-left">
					<FileImage size={22} class="text-primary shrink-0" />
					<div>
						<p class="text-sm font-semibold">Upload result</p>
						<p class="text-xs text-muted-foreground">Typed vote counts per party from the posted EC8A</p>
					</div>
				</button>
				<button onclick={() => (mode = 'incident')} class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-border bg-card text-left">
					<TriangleAlert size={22} class="text-destructive shrink-0" />
					<div>
						<p class="text-sm font-semibold">Report incident</p>
						<p class="text-xs text-muted-foreground">Violence, vote-buying, intimidation, missing materials</p>
					</div>
				</button>
			</div>
		{:else if mode === 'results'}
			<label class="block mb-3">
				<span class="block text-sm font-medium text-foreground mb-1.5">Race</span>
				<select bind:value={raceType} onchange={loadParties} class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
					<option value="pres">Presidential</option>
					<option value="nass">National Assembly</option>
					<option value="gov">Governorship</option>
					<option value="shoa">State House of Assembly</option>
				</select>
			</label>

			{#if parties.length === 0}
				<p class="text-sm text-muted-foreground mb-4">No party list loaded for this race yet.</p>
			{:else}
				<div class="space-y-2 mb-4">
					{#each parties as p (p.code)}
						<div class="flex items-center justify-between gap-3 border border-border rounded-xl px-4 py-2.5">
							<span class="text-sm">{p.name}</span>
							<input type="number" min="0" bind:value={votes[p.code]} class="w-24 bg-input-background border border-border rounded-lg px-2 py-1.5 text-sm text-right" />
						</div>
					{/each}
				</div>
			{/if}

			{#if outcome && !outcome.ok}<p class="text-sm text-destructive mb-3">{outcome.error}</p>{/if}
			<button onclick={doResults} disabled={submitting || parties.length === 0} class="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold text-sm disabled:opacity-50">
				{submitting ? 'Submitting…' : 'Submit result'}
			</button>
		{:else if mode === 'incident'}
			<label class="block mb-3">
				<span class="block text-sm font-medium text-foreground mb-1.5">Category</span>
				<select bind:value={incidentCategory} class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm">
					<option value="violence">Violence</option>
					<option value="vote_buying">Vote buying</option>
					<option value="intimidation">Intimidation</option>
					<option value="materials_missing">Materials missing</option>
					<option value="other">Other</option>
				</select>
			</label>
			<label class="block mb-4">
				<span class="block text-sm font-medium text-foreground mb-1.5">Note (optional, 280 characters)</span>
				<textarea bind:value={incidentNote} maxlength="280" rows="3" class="w-full bg-input-background border border-border rounded-xl px-4 py-2.5 text-sm resize-none"></textarea>
			</label>
			{#if outcome && !outcome.ok}<p class="text-sm text-destructive mb-3">{outcome.error}</p>{/if}
			<button onclick={doIncident} disabled={submitting} class="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold text-sm disabled:opacity-50">
				{submitting ? 'Submitting…' : 'Submit incident'}
			</button>
		{/if}
	{/if}
</div>
