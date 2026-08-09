<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { REPORT_CATEGORIES, REPORT_SEVERITIES } from '$lib/reports';
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';

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

	let reports: Report[] = $state([]);
	let loading = $state(true);
	let loadError = $state('');
	let acting = $state<string | null>(null);
	let userEmail = $state('');

	function categoryLabel(v: string) {
		return REPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;
	}
	function severityLabel(v: string) {
		return REPORT_SEVERITIES.find((s) => s.value === v)?.label ?? v;
	}

	async function loadPending() {
		loading = true;
		const { data, error } = await supabase
			.from('reports')
			.select('id, category, severity, description, created_at, admin_level1(name), report_media(id, storage_path, media_type, processing_status)')
			.eq('status', 'pending')
			.order('created_at', { ascending: true });
		if (error) {
			loadError = error.message;
		} else {
			reports = (data ?? []) as unknown as Report[];
		}
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

	async function act(reportId: string, action: 'approve' | 'reject') {
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
				headers: {
					'Content-Type': 'application/json',
					apikey: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ report_id: reportId, action }),
			});
			if (!res.ok) {
				const body = await res.json();
				alert(body.error ?? `request failed (${res.status})`);
				return;
			}
			reports = reports.filter((r) => r.id !== reportId);
		} finally {
			acting = null;
		}
	}

	async function logout() {
		await supabase.auth.signOut();
		await goto('/mod/login');
	}
</script>

<h1>Moderation queue</h1>
<p>
	{userEmail} · <button onclick={logout}>Sign out</button>
</p>

{#if loading}
	<p>Loading…</p>
{:else if loadError}
	<p role="alert">Error: {loadError}</p>
{:else if reports.length === 0}
	<p>Nothing pending.</p>
{:else}
	{#each reports as r (r.id)}
		<article style="border: 1px solid; padding: 1rem; margin-bottom: 1rem;">
			<h2>{categoryLabel(r.category)} — {severityLabel(r.severity)}</h2>
			<p>{r.admin_level1?.name ?? ''} · {new Date(r.created_at).toLocaleString()}</p>
			{#if r.description}<p>{r.description}</p>{/if}

			{#if r.report_media.length === 0}
				<p><small>No media attached.</small></p>
			{:else}
				{#each r.report_media as m (m.id)}
					{#if m.processing_status === 'clean'}
						{@const url = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${m.storage_path}`}
						{#if m.media_type === 'video'}
							<video controls src={url} style="max-width: 100%; max-height: 300px;"></video>
						{:else}
							<img src={url} alt="" style="max-width: 100%; max-height: 300px;" />
						{/if}
					{:else}
						<p><small>Media still processing ({m.processing_status}).</small></p>
					{/if}
				{/each}
			{/if}

			<div style="margin-top: 0.5rem;">
				<button disabled={acting === r.id} onclick={() => act(r.id, 'approve')}>
					{acting === r.id ? 'Working…' : 'Approve'}
				</button>
				<button disabled={acting === r.id} onclick={() => act(r.id, 'reject')}>
					{acting === r.id ? 'Working…' : 'Reject'}
				</button>
			</div>
		</article>
	{/each}
{/if}
