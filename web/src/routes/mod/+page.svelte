<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { getCategory } from '$lib/design/categories';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import SevBadge from '$lib/components/SevBadge.svelte';

	interface Media {
		id: string;
		storage_path: string;
		media_type: 'image' | 'video';
		processing_status: string;
	}
	interface Report {
		id: string;
		category: string;
		severity: string;
		description: string | null;
		created_at: string;
		admin_level1: { name: string } | null;
		report_media: Media[];
	}
	interface Incident {
		id: string;
		captured_at: string;
		polling_units: { name: string; official_pu_code: string } | null;
		incident_details: { category: string; note: string | null } | null;
	}

	let reports: Report[] = $state([]);
	let incidents: Incident[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');
	let acting = $state<string | null>(null);
	let userEmail = $state('');

	async function loadPending() {
		loading = true;
		const [{ data, error }, { data: incidentData, error: incidentErr }] = await Promise.all([
			supabase
				.from('reports')
				.select('id, category, severity, description, created_at, admin_level1(name), report_media(id, storage_path, media_type, processing_status)')
				.eq('status', 'pending')
				.order('created_at', { ascending: true }),
			supabase
				.from('election_reports')
				.select('id, captured_at, polling_units(name, official_pu_code), incident_details(category, note)')
				.eq('type', 'incident')
				.eq('status', 'pending')
				.order('captured_at', { ascending: true }),
		]);
		if (error) loadError = error.message;
		else reports = (data ?? []) as unknown as Report[];
		if (incidentErr) console.error('failed to load election incidents', incidentErr);
		else incidents = (incidentData ?? []) as unknown as Incident[];
		loading = false;
	}

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			await goto('/mod/login');
			return;
		}
		userEmail = data.session.user.email ?? '';
		await loadPending();
	});

	async function act(reportId: string, action: 'approve' | 'reject', targetTable: 'reports' | 'election_reports' = 'reports') {
		acting = reportId;
		try {
			const { data } = await supabase.auth.getSession();
			const token = data.session?.access_token;
			if (!token) {
				await goto('/mod/login');
				return;
			}
			const res = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/moderate-report`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
				body: JSON.stringify({ report_id: reportId, action, target_table: targetTable }),
			});
			if (!res.ok) {
				const body = await res.json();
				alert(body.error ?? `request failed (${res.status})`);
				return;
			}
			if (targetTable === 'election_reports') incidents = incidents.filter((r) => r.id !== reportId);
			else reports = reports.filter((r) => r.id !== reportId);
		} finally {
			acting = null;
		}
	}

	async function logout() {
		await supabase.auth.signOut();
		await goto('/mod/login');
	}
</script>

<div class="flex items-center justify-between mb-1">
	<h1 class="text-2xl font-semibold font-display">Moderation queue</h1>
</div>
<p class="text-sm text-muted-foreground mb-6">
	{userEmail} · <a href="/mod/budget" class="text-primary">Add budget data</a> ·
	<a href="/mod/campaigns/new" class="text-primary">New campaign</a> ·
	<button onclick={logout} class="text-primary">Sign out</button>
</p>

{#if loading}
	<p class="text-sm text-muted-foreground">Loading…</p>
{:else if loadError}
	<p class="text-sm text-destructive">Error: {loadError}</p>
{:else}
	{#if incidents.length > 0}
		<h2 class="text-sm font-semibold text-foreground mb-3">Election incidents ({incidents.length})</h2>
		<div class="space-y-3 mb-8">
			{#each incidents as inc (inc.id)}
				<article class="border border-border rounded-2xl bg-card p-4">
					<p class="text-sm font-semibold text-foreground capitalize">{inc.incident_details?.category.replace('_', ' ') ?? 'unknown'}</p>
					<p class="text-xs text-muted-foreground mb-2">
						{inc.polling_units?.name ?? 'unknown PU'} ({inc.polling_units?.official_pu_code ?? '—'}) · {new Date(inc.captured_at).toLocaleString()}
					</p>
					{#if inc.incident_details?.note}<p class="text-sm text-foreground mb-3">{inc.incident_details.note}</p>{/if}
					<div class="flex gap-2 mt-2">
						<button
							disabled={acting === inc.id}
							onclick={() => act(inc.id, 'approve', 'election_reports')}
							class="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50"
						>
							{acting === inc.id ? 'Working…' : 'Approve'}
						</button>
						<button
							disabled={acting === inc.id}
							onclick={() => act(inc.id, 'reject', 'election_reports')}
							class="px-4 py-2 border border-border rounded-xl text-xs font-semibold disabled:opacity-50"
						>
							Reject
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<h2 class="text-sm font-semibold text-foreground mb-3">Condition reports</h2>
	{#if reports.length === 0}
		<p class="text-sm text-muted-foreground">Nothing pending.</p>
	{:else}
		<div class="space-y-3">
			{#each reports as r (r.id)}
				{@const cat = getCategory(r.category)}
				{@const Icon = cat.icon}
				<article class="border border-border rounded-2xl bg-card p-4">
					<div class="flex items-center gap-2.5 mb-2">
						<div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background: {cat.bg};">
							<Icon size={15} color={cat.color} />
						</div>
						<div>
							<p class="text-sm font-semibold text-foreground">{cat.label}</p>
							<p class="text-xs text-muted-foreground">{r.admin_level1?.name ?? ''} · {new Date(r.created_at).toLocaleString()}</p>
						</div>
						<div class="ml-auto"><SevBadge level={r.severity} /></div>
					</div>
					{#if r.description}<p class="text-sm text-foreground mb-3">{r.description}</p>{/if}

					{#if r.report_media.length > 0}
						<div class="space-y-2 mb-3">
							{#each r.report_media as m (m.id)}
								{#if m.processing_status === 'clean'}
									{@const url = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${m.storage_path}`}
									{#if m.media_type === 'video'}
										<video controls src={url} class="max-w-full max-h-72 rounded-xl border border-border">
											<track kind="captions" />
										</video>
									{:else}
										<img src={url} alt="" class="max-w-full max-h-72 rounded-xl border border-border" />
									{/if}
								{:else}
									<p class="text-xs text-muted-foreground">Media still processing ({m.processing_status}).</p>
								{/if}
							{/each}
						</div>
					{:else}
						<p class="text-xs text-muted-foreground mb-3">No media attached.</p>
					{/if}

					<div class="flex gap-2">
						<button
							disabled={acting === r.id}
							onclick={() => act(r.id, 'approve')}
							class="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold disabled:opacity-50"
						>
							{acting === r.id ? 'Working…' : 'Approve'}
						</button>
						<button
							disabled={acting === r.id}
							onclick={() => act(r.id, 'reject')}
							class="px-4 py-2 border border-border rounded-xl text-xs font-semibold disabled:opacity-50"
						>
							Reject
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
{/if}
