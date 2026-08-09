<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';

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

<h1>Moderator login</h1>

<form onsubmit={login}>
	<label>
		Email
		<input type="email" bind:value={email} required />
	</label>
	<label>
		Password
		<input type="password" bind:value={password} required />
	</label>
	<button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
</form>

{#if error}
	<p role="alert">{error}</p>
{/if}
