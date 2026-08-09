<script lang="ts">
	import { getCategory } from '$lib/design/categories';
	import { relativeAge } from '$lib/relativeTime';
	import SevBadge from './SevBadge.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import LifecycleBar from './LifecycleBar.svelte';
	import Share2 from 'lucide-svelte/icons/share-2';

	let {
		id,
		category,
		severity,
		status,
		lifecycle,
		description,
		createdAt,
		locationLabel,
		photoUrl,
		compact = false,
	}: {
		id: string;
		category: string;
		severity: string;
		status: string;
		lifecycle: string;
		description: string | null;
		createdAt: string;
		locationLabel: string;
		photoUrl?: string;
		compact?: boolean;
	} = $props();

	let cat = $derived(getCategory(category));
	let isCritical = $derived(severity === 'critical');
	let Icon = $derived(cat.icon);
</script>

<a
	href="/Nig/reports/{id}"
	class="block bg-card rounded-2xl overflow-hidden border border-border shadow-sm active:scale-[0.99] transition-transform"
	style="border-left-width: 3px; border-left-color: {cat.color};"
>
	{#if photoUrl && !compact}
		<div class="h-36 bg-muted overflow-hidden">
			<img src={photoUrl} alt="Evidence" class="w-full h-full object-cover" />
		</div>
	{/if}
	<div class="p-4">
		<div class="flex items-start justify-between gap-2 mb-2.5">
			<div class="flex items-center gap-2.5 min-w-0">
				<div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background: {cat.bg};">
					<Icon size={15} color={cat.color} />
				</div>
				<div class="min-w-0">
					<p class="text-sm font-medium text-foreground truncate">{locationLabel}</p>
					<p class="text-[10px] text-muted-foreground font-code">{id.slice(0, 8)}</p>
				</div>
			</div>
			<div class="flex items-center gap-1.5 shrink-0">
				{#if isCritical}
					<span class="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded tracking-wide">URGENT</span>
				{/if}
				<span class="text-xs text-muted-foreground">{relativeAge(createdAt)}</span>
			</div>
		</div>

		{#if description}
			<p class="text-sm text-foreground leading-snug mb-3 {compact ? 'line-clamp-1' : 'line-clamp-2'}">{description}</p>
		{/if}

		<div class="mb-3">
			<LifecycleBar stage={lifecycle} />
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<SevBadge level={severity} />
			<StatusBadge {status} />
			<div class="ml-auto flex items-center gap-3">
				<button
					type="button"
					class="text-muted-foreground active:text-primary transition-colors"
					aria-label="Share this report"
					onclick={(e) => e.preventDefault()}
				>
					<Share2 size={13} />
				</button>
			</div>
		</div>
	</div>
</a>
