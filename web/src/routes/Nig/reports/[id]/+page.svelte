<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import { REPORT_CATEGORIES, REPORT_SEVERITIES } from '$lib/reports';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';

	const id = page.params.id;

	interface Report {
		id: string;
		category: string;
		severity: string;
		description: string | null;
		level1_id: string;
		lifecycle: string;
		created_at: string;
		x_tweet_id: string | null;
	}
	interface Media {
		id: string;
		storage_path: string;
		media_type: 'image' | 'video';
	}

	let report: Report | null = $state(null);
	let media: Media[] = $state([]);
	let level1Name = $state('');
	let loading = $state(true);
	let loadError = $state('');

	function categoryLabel(v: string) {
		return REPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
	}
	function severityLabel(v: string) {
		return REPORT_SEVERITIES.find((s) => s.value === v)?.label ?? v;
	}

	// X's widgets.js only auto-processes <blockquote class="twitter-tweet">
	// elements present when it first loads — on an SPA navigation to a
	// report page it's already loaded, so re-invoke .load() to pick up the
	// new blockquote instead of relying on the script re-running.
	function loadTwitterWidget() {
		const w = window as unknown as { twttr?: { widgets?: { load: () => void } } };
		if (document.getElementById('twitter-wjs')) {
			w.twttr?.widgets?.load();
			return;
		}
		const script = document.createElement('script');
		script.id = 'twitter-wjs';
		script.src = 'https://platform.twitter.com/widgets.js';
		script.async = true;
		document.body.appendChild(script);
	}

	onMount(async () => {
		const { data, error } = await supabase
			.from('reports')
			.select('id, category, severity, description, level1_id, lifecycle, created_at, x_tweet_id')
			.eq('id', id)
			.maybeSingle();
		if (error || !data) {
			loadError = error?.message ?? 'report not found';
			loading = false;
			return;
		}
		report = data as Report;

		const { data: level1 } = await supabase
			.from('admin_level1')
			.select('name')
			.eq('id', report.level1_id)
			.maybeSingle();
		level1Name = level1?.name ?? '';

		// Not read directly off the report's status — a report can only be
		// visible here at all once published (RLS), but its media might
		// still be mid-pipeline, so this is its own check, not an assumption.
		const { data: mediaRows } = await supabase
			.from('report_media')
			.select('id, storage_path, media_type')
			.eq('report_id', id)
			.eq('processing_status', 'clean');
		media = (mediaRows ?? []) as Media[];

		loading = false;

		// Prefer embedding from X once a report has posted there — it costs
		// nothing to serve (X's CDN, not ours) and reinforces the repost/
		// growth loop. Falls back to Supabase-direct otherwise (see the
		// media branch below), which is why the Supabase copy is always
		// kept regardless of X posting status.
		if (report.x_tweet_id) {
			setTimeout(loadTwitterWidget, 0);
		}
	});
</script>

<a href="/Nig">&larr; all reports</a>

{#if loading}
	<p>Loading…</p>
{:else if loadError}
	<p role="alert">Error: {loadError}</p>
{:else if report}
	<h1>{categoryLabel(report.category)}</h1>
	<p>{severityLabel(report.severity)} severity · {level1Name} · {report.lifecycle}</p>
	{#if report.description}<p>{report.description}</p>{/if}
	<p><small>{new Date(report.created_at).toLocaleString()}</small></p>

	{#if report.x_tweet_id}
		<blockquote class="twitter-tweet">
			<a href="https://twitter.com/Citiznking/status/{report.x_tweet_id}">View this report on X</a>
		</blockquote>
	{:else if media.length > 0}
		{#each media as m (m.id)}
			{@const url = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${m.storage_path}`}
			{#if m.media_type === 'video'}
				<video controls src={url} style="max-width: 100%;"></video>
			{:else}
				<img src={url} alt={categoryLabel(report.category)} style="max-width: 100%;" />
			{/if}
		{/each}
	{:else}
		<p><small>No media attached yet.</small></p>
	{/if}
{/if}
