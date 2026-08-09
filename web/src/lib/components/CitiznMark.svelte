<script lang="ts">
	// Canonical mark per CITIZN-BRAND-SPEC.md — do not alter the path
	// geometry. currentColor drives the ring; the eye is currentColor in
	// everyday mode, or signal amber with the full-aperture path in
	// election mode. Election mode is a deliberate seasonal switch, not a
	// style option — only /Nig/2027election routes should ever pass it.
	let { mode = 'everyday', size = 24 }: { mode?: 'everyday' | 'election'; size?: number } = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width={size} height={size * 1.2}>
	<path
		d="M 79.11 53.26 A 30 30 0 0 1 68.47 69.64 C 60.6 75.8, 54.6 92, 50 102 C 45.4 92, 39.4 75.8, 31.53 69.64 A 30 30 0 1 1 79.11 38.74"
		fill="none"
		stroke="currentColor"
		stroke-width="9"
		stroke-linecap="round"
		stroke-linejoin="miter"
		stroke-miterlimit="6"
	/>
	{#if mode === 'election'}
		<path
			d="M 63 46 A 13 13 0 1 0 37 46 A 13 13 0 1 0 63 46 Z M 54.5 46 A 4.5 4.5 0 1 0 45.5 46 A 4.5 4.5 0 1 0 54.5 46 Z"
			fill="#F5A623"
			fill-rule="evenodd"
		/>
	{:else}
		<path
			d="M 37 47 A 13 13 0 0 0 63 47 Z M 54.5 51.5 A 4.5 4.5 0 1 0 45.5 51.5 A 4.5 4.5 0 1 0 54.5 51.5 Z"
			fill="currentColor"
			fill-rule="evenodd"
		/>
	{/if}
</svg>
