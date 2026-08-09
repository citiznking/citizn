<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import Lock from 'lucide-svelte/icons/lock';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let error = $state('');

	async function login(e: SubmitEvent) {
		e.preventDefault();
		submitting = true;
		error = '';
		const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
		if (authErr) {
			error = authErr.message;
			submitting = false;
			return;
		}
		await goto('/mod');
	}
</script>

<div class="flex items-center gap-2 mb-5">
	<Lock size={18} class="text-primary" />
	<h1 class="text-2xl font-semibold font-display">Moderator login</h1>
</div>

<form onsubmit={login} class="space-y-4 max-w-sm">
	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Email</span>
		<input type="email" bind:value={email} required class="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary" />
	</label>
	<label class="block">
		<span class="block text-sm font-medium text-foreground mb-1.5">Password</span>
		<input type="password" bind:value={password} required class="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary" />
	</label>
	<button type="submit" disabled={submitting} class="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50">
		{submitting ? 'Signing in…' : 'Sign in'}
	</button>
</form>

{#if error}
	<p class="text-sm text-destructive mt-3">{error}</p>
{/if}
