export interface StatusConfig {
	label: string;
	cls: string;
}

export const STATUS: Record<string, StatusConfig> = {
	pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
	published: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
	flagged: { label: 'Flagged', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
	removed: { label: 'Removed', cls: 'bg-muted text-muted-foreground border-border' },
};

export const LIFECYCLE_STAGES = ['reported', 'acknowledged', 'in_progress', 'fixed'];
export const LIFECYCLE_LABELS: Record<string, string> = {
	reported: 'Reported',
	acknowledged: 'Acknowledged',
	in_progress: 'In Progress',
	fixed: 'Fixed',
};
