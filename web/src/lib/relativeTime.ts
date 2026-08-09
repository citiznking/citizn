export function relativeAge(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const min = Math.floor(diffMs / 60000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min} min`;
	const hrs = Math.floor(min / 60);
	if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'}`;
	const days = Math.floor(hrs / 24);
	if (days === 1) return 'Yesterday';
	if (days < 7) return `${days} days`;
	return new Date(iso).toLocaleDateString();
}
