export interface SeverityConfig {
	label: string;
	pill: string;
	dot: string;
	textColor: string;
	desc: string;
}

export const SEVERITY: Record<string, SeverityConfig> = {
	low: { label: 'Low', pill: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', textColor: 'text-emerald-700', desc: 'Minor inconvenience, not urgent' },
	medium: { label: 'Medium', pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', textColor: 'text-amber-700', desc: 'Affects daily life, needs attention' },
	high: { label: 'High', pill: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', textColor: 'text-orange-700', desc: 'Significant impact or potential danger' },
	critical: { label: 'Critical', pill: 'bg-red-100 text-red-800', dot: 'bg-red-500', textColor: 'text-red-700', desc: 'Immediate risk to life or safety' },
};

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
export const SEVERITY_RADIUS: Record<string, number> = { critical: 13, high: 10, medium: 8, low: 6 };
