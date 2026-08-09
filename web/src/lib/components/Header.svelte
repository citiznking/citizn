<script lang="ts">
	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';
	import CitiznMark from './CitiznMark.svelte';

	let { dark, onToggleDark }: { dark: boolean; onToggleDark: () => void } = $props();
</script>

<header class="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
	<a href="/Nig" class="flex items-center gap-2 text-primary">
		<CitiznMark size={22} />
		<span class="text-[20px] leading-none font-wordmark text-foreground">citizn</span>
	</a>

	<button
		type="button"
		onclick={onToggleDark}
		class="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground active:bg-muted transition-colors"
		aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
	>
		{#if dark}
			<Sun size={17} />
		{:else}
			<Moon size={17} />
		{/if}
	</button>
</header>
