import { redirect } from '@sveltejs/kit';

// Spec: "/Nig2027election kept as a redirect alias" to the real route.
export function load() {
	redirect(301, '/Nig/2027election');
}
