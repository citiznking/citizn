<script lang="ts">
	import { SEVERITY } from '$lib/design/severity';

	let { level }: { level: string } = $props();
	let s = $derived(SEVERITY[level] ?? SEVERITY.low);
</script>

<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold {s.pill}">
	<span class="w-1.5 h-1.5 rounded-full {s.dot}"></span>
	{s.label}
</span>
