<script lang="ts">
	import { page } from '$app/state';
	import Newspaper from 'lucide-svelte/icons/newspaper';
	import MapPin from 'lucide-svelte/icons/map-pin';
	import Plus from 'lucide-svelte/icons/plus';
	import Trophy from 'lucide-svelte/icons/trophy';

	let path = $derived(page.url.pathname);
	let country = $derived(page.params.country ?? 'Nig');
	function active(prefix: string, exact = false) {
		return exact ? path === prefix : path === prefix || path.startsWith(`${prefix}/`);
	}
</script>

<nav class="flex items-center border-t border-border bg-background shrink-0 px-2">
	<a
		href="/{country}"
		class="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-colors {active(`/${country}`, true)
			? 'text-primary'
			: 'text-muted-foreground'}"
	>
		<Newspaper size={20} />
		<span class="text-[10px] font-medium">Feed</span>
	</a>

	<a
		href="/{country}/map"
		class="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-colors {active(`/${country}/map`)
			? 'text-primary'
			: 'text-muted-foreground'}"
	>
		<MapPin size={20} />
		<span class="text-[10px] font-medium">Map</span>
	</a>

	<a href="/{country}/report" class="flex flex-col items-center gap-1 py-2 px-4">
		<div class="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg active:scale-95 transition-transform">
			<Plus size={22} class="text-primary-foreground" />
		</div>
		<span class="text-[10px] font-medium text-muted-foreground">Report</span>
	</a>

	<a
		href="/{country}/campaigns"
		class="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-colors {active(`/${country}/campaigns`)
			? 'text-primary'
			: 'text-muted-foreground'}"
	>
		<Trophy size={20} />
		<span class="text-[10px] font-medium">Campaigns</span>
	</a>
</nav>
