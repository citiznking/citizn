const STORAGE_KEY = 'citizn-dark';

export function getInitialDark(): boolean {
	if (typeof localStorage === 'undefined') return false;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored !== null) return stored === '1';
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function persistDark(dark: boolean) {
	localStorage.setItem(STORAGE_KEY, dark ? '1' : '0');
}
