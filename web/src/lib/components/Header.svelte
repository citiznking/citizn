<script lang="ts">
	import Lock from 'lucide-svelte/icons/lock';
	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';

	let { dark, onToggleDark }: { dark: boolean; onToggleDark: () => void } = $props();
</script>

<header class="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
	<a href="/Nig" class="flex items-center gap-2">
		<h1 class="text-[22px] font-semibold leading-none font-display italic">Citizn</h1>
		<span class="flex items-center gap-1 text-[9px] font-semibold text-primary bg-secondary px-1.5 py-0.5 rounded border border-border">
			<Lock size={8} /> anonymous
		</span>
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
