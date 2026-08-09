<script lang="ts">
	import { LIFECYCLE_STAGES, LIFECYCLE_LABELS } from '$lib/design/status';

	let { stage }: { stage: string } = $props();
	let idx = $derived(LIFECYCLE_STAGES.indexOf(stage));
</script>

<div class="flex items-center gap-0">
	{#each LIFECYCLE_STAGES as s, i (s)}
		<div class="flex items-center flex-1 last:flex-none">
			<div
				class="w-2.5 h-2.5 rounded-full border-2 shrink-0 transition-colors {i <= idx
					? 'bg-primary border-primary'
					: 'border-muted-foreground/30 bg-transparent'}"
			></div>
			{#if i < LIFECYCLE_STAGES.length - 1}
				<div class="flex-1 h-[2px] {i < idx ? 'bg-primary' : 'bg-border'}"></div>
			{/if}
		</div>
	{/each}
</div>
<p class="text-[10px] text-muted-foreground mt-1.5">{LIFECYCLE_LABELS[stage] ?? stage}</p>
