<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { supabase } from '$lib/supabase';
	import { getCategory } from '$lib/design/categories';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import SevBadge from '$lib/components/SevBadge.svelte';
	import LifecycleBar from '$lib/components/LifecycleBar.svelte';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';

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

		const { data: level1 } = await supabase.from('admin_level1').select('name').eq('id', report.level1_id).maybeSingle();
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
		// growth loop. Falls back to Supabase-direct otherwise, which is why
		// the Supabase copy is always kept regardless of X posting status.
		if (report.x_tweet_id) {
			setTimeout(loadTwitterWidget, 0);
		}
	});
</script>

<div class="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-border">
	<a href="/Nig" class="p-1.5 -ml-1.5 rounded-xl text-foreground/60 active:bg-muted transition-colors" aria-label="All reports">
		<ChevronLeft size={20} />
	</a>
	<span class="text-sm font-medium">All reports</span>
</div>

{#if loading}
	<p class="text-sm text-muted-foreground text-center py-12">Loading…</p>
{:else if loadError}
	<p role="alert" class="text-sm text-destructive text-center py-12">Error: {loadError}</p>
{:else if report}
	{@const cat = getCategory(report.category)}
	{@const Icon = cat.icon}
	<div class="p-4">
		<div class="flex items-center gap-3 mb-3">
			<div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style="background: {cat.bg};">
				<Icon size={20} color={cat.color} />
			</div>
			<div>
				<h1 class="text-xl font-semibold font-display">{cat.label}</h1>
				<p class="text-xs text-muted-foreground">{level1Name} · {new Date(report.created_at).toLocaleString()}</p>
			</div>
		</div>

		<div class="flex items-center gap-2 mb-4">
			<SevBadge level={report.severity} />
		</div>

		{#if report.description}
			<p class="text-sm text-foreground leading-relaxed mb-4">{report.description}</p>
		{/if}

		<div class="border border-border rounded-2xl p-4 mb-4">
			<LifecycleBar stage={report.lifecycle} />
		</div>

		{#if report.x_tweet_id}
			<blockquote class="twitter-tweet">
				<a href="https://twitter.com/Citiznking/status/{report.x_tweet_id}">View this report on X</a>
			</blockquote>
		{:else if media.length > 0}
			<div class="space-y-3">
				{#each media as m (m.id)}
					{@const url = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${m.storage_path}`}
					{#if m.media_type === 'video'}
						<video controls src={url} class="w-full rounded-2xl border border-border">
							<track kind="captions" />
						</video>
					{:else}
						<img src={url} alt={cat.label} class="w-full rounded-2xl border border-border" />
					{/if}
				{/each}
			</div>
		{:else}
			<p class="text-xs text-muted-foreground">No media attached yet.</p>
		{/if}
	</div>
{/if}
