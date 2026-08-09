<script lang="ts">
	import { supabase } from '$lib/supabase';
	import CircleCheck from 'lucide-svelte/icons/circle-check';
	import FileImage from 'lucide-svelte/icons/file-image';
	import TriangleAlert from 'lucide-svelte/icons/triangle-alert';

	interface Row {
		id: string;
		type: 'inec_arrival' | 'result_upload' | 'incident';
		status: string;
		corroboration_count: number;
	}

	let rows: Row[] = $state([]);
	let loading = $state(true);

	supabase
		.from('election_reports')
		.select('id, type, status, corroboration_count')
		.then(({ data }) => {
			rows = (data ?? []) as Row[];
			loading = false;
		});

	let checkins = $derived(rows.filter((r) => r.type === 'inec_arrival'));
	let resultUploads = $derived(rows.filter((r) => r.type === 'result_upload'));
	let incidents = $derived(rows.filter((r) => r.type === 'incident' && r.status === 'published'));
	let corroboratedResults = $derived(resultUploads.filter((r) => r.corroboration_count >= 2).length);
</script>

<div class="p-4">
	<h1 class="text-2xl font-semibold font-display mb-1">Live election dashboard</h1>
	<p class="text-sm text-muted-foreground mb-5">
		Citizen-reported, unofficial. Aggregated in near-real-time from anonymous submissions.
	</p>

	{#if loading}
		<p class="text-sm text-muted-foreground">Loading…</p>
	{:else}
		<div class="grid grid-cols-1 gap-3">
			<div class="border border-border rounded-2xl p-4 flex items-center gap-3">
				<div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
					<CircleCheck size={18} class="text-emerald-600" />
				</div>
				<div>
					<p class="text-2xl font-bold font-code">{checkins.length}</p>
					<p class="text-xs text-muted-foreground">INEC arrival check-ins</p>
				</div>
			</div>

			<div class="border border-border rounded-2xl p-4 flex items-center gap-3">
				<div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
					<FileImage size={18} class="text-blue-600" />
				</div>
				<div>
					<p class="text-2xl font-bold font-code">{resultUploads.length}</p>
					<p class="text-xs text-muted-foreground">
						result uploads · {corroboratedResults} corroborated (2+ matching)
					</p>
				</div>
			</div>

			<div class="border border-border rounded-2xl p-4 flex items-center gap-3">
				<div class="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
					<TriangleAlert size={18} class="text-destructive" />
				</div>
				<div>
					<p class="text-2xl font-bold font-code">{incidents.length}</p>
					<p class="text-xs text-muted-foreground">published incidents</p>
				</div>
			</div>
		</div>

		{#if rows.length === 0}
			<p class="text-sm text-muted-foreground text-center mt-8">No election-day activity recorded yet.</p>
		{/if}
	{/if}
</div>
