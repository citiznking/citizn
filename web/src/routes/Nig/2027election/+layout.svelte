<script lang="ts">
	import CitiznMark from '$lib/components/CitiznMark.svelte';

	let { children } = $props();
</script>

<div class="election -m-4 p-4 min-h-dvh bg-background text-foreground">
	<a href="/Nig/2027election" class="flex items-center gap-2 mb-6">
		<span class="text-white"><CitiznMark mode="election" size={26} /></span>
		<div>
			<span class="block text-lg font-wordmark text-white">citizn</span>
			<span class="block text-[10px] font-semibold tracking-widest uppercase text-primary">Election watch is on</span>
		</div>
	</a>
	{@render children()}
</div>
