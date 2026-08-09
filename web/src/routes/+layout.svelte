<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/Header.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { page } from '$app/state';
	import { getInitialDark, persistDark } from '$lib/darkMode';

	let { children } = $props();

	let dark = $state(false);
	$effect(() => {
		dark = getInitialDark();
	});
	function toggleDark() {
		dark = !dark;
		persistDark(dark);
	}

	// The moderation console and claim/redemption flows aren't part of the
	// citizen-facing app shell — they get plain full-width layouts instead
	// of the phone-frame + bottom nav treatment.
	let isChromeless = $derived(
		page.url.pathname.startsWith('/mod') || page.url.pathname === '/claim' || page.url.pathname === '/Nig/budget',
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class={dark ? 'dark' : ''}>
	{#if isChromeless}
		<div class="min-h-dvh bg-background text-foreground">
			<div class="max-w-2xl mx-auto p-4">
				{@render children()}
			</div>
		</div>
	{:else}
		<div class="min-h-dvh bg-slate-300 dark:bg-[#020912] flex items-center justify-center sm:p-8">
			<div
				class="relative bg-background text-foreground w-full sm:max-w-[430px] h-dvh sm:h-[844px] flex flex-col sm:rounded-[40px] sm:shadow-[0_30px_80px_rgba(0,0,0,0.28)] overflow-hidden"
			>
				<Header {dark} onToggleDark={toggleDark} />
				<main class="flex-1 overflow-y-auto scrollbar-none relative">
					{@render children()}
				</main>
				<BottomNav />
			</div>
		</div>
	{/if}
</div>
