<script lang="ts">
	import CitiznMark from '$lib/components/CitiznMark.svelte';
	import { COUNTRIES } from '$lib/countries';
</script>

<div class="min-h-dvh flex flex-col items-center justify-center bg-background text-foreground px-6 text-center">
	<div class="text-primary mb-4">
		<CitiznMark size={56} />
	</div>
	<h1 class="text-2xl font-wordmark mb-2">citizn</h1>
	<p class="text-sm text-muted-foreground mb-8">See it. Report it. Watch it change.</p>
	<div class="flex flex-col gap-2.5 w-full max-w-xs">
		{#each COUNTRIES as c (c.slug)}
			<a
				href="/{c.slug}"
				class="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
			>
				{c.name}
			</a>
		{/each}
	</div>
</div>
