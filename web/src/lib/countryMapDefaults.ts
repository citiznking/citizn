export const COUNTRY_MAP_DEFAULTS: Record<string, { center: [number, number]; zoom: number }> = {
	Nig: { center: [8.6753, 9.082], zoom: 5.5 },
	Ken: { center: [37.9062, 0.0236], zoom: 6 },
	Gha: { center: [-1.0232, 7.9465], zoom: 6.5 },
};

export function mapDefaultsFor(country: string) {
	return COUNTRY_MAP_DEFAULTS[country] ?? { center: [17, 5], zoom: 3 };
}
