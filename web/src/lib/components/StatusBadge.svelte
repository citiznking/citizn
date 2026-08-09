<script lang="ts">
	import Clock from 'lucide-svelte/icons/clock';
	import Eye from 'lucide-svelte/icons/eye';
	import Flag from 'lucide-svelte/icons/flag';
	import Ban from 'lucide-svelte/icons/ban';
	import { STATUS } from '$lib/design/status';

	let { status }: { status: string } = $props();
	let s = $derived(STATUS[status] ?? STATUS.pending);
	let Icon = $derived(status === 'published' ? Eye : status === 'flagged' ? Flag : status === 'removed' ? Ban : Clock);
</script>

<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border {s.cls}">
	<Icon size={10} />
	{s.label}
</span>
