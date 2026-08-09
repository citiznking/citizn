import Wrench from 'lucide-svelte/icons/wrench';
import Activity from 'lucide-svelte/icons/activity';
import GraduationCap from 'lucide-svelte/icons/graduation-cap';
import Zap from 'lucide-svelte/icons/zap';
import Droplets from 'lucide-svelte/icons/droplets';
import Trash2 from 'lucide-svelte/icons/trash-2';
import Car from 'lucide-svelte/icons/car';
import Leaf from 'lucide-svelte/icons/leaf';
import Shield from 'lucide-svelte/icons/shield';
import Scale from 'lucide-svelte/icons/scale';
import type { ComponentType } from 'svelte';

export interface CategoryConfig {
	id: string;
	label: string;
	icon: ComponentType;
	color: string;
	bg: string;
	sensitive?: boolean;
}

// id matches the report_category DB enum exactly — label/icon/color are
// presentation only, ported from the Figma design.
export const CATEGORIES: CategoryConfig[] = [
	{ id: 'road', label: 'Roads & Paths', icon: Wrench, color: '#1D4ED8', bg: '#DBEAFE' },
	{ id: 'hospital', label: 'Healthcare', icon: Activity, color: '#BE185D', bg: '#FCE7F3' },
	{ id: 'school', label: 'Schools', icon: GraduationCap, color: '#7C3AED', bg: '#EDE9FE' },
	{ id: 'power', label: 'Power', icon: Zap, color: '#D97706', bg: '#FEF3C7' },
	{ id: 'water', label: 'Water', icon: Droplets, color: '#0369A1', bg: '#E0F2FE' },
	{ id: 'sanitation', label: 'Sanitation', icon: Trash2, color: '#059669', bg: '#D1FAE5' },
	{ id: 'traffic', label: 'Traffic', icon: Car, color: '#9A3412', bg: '#FFEDD5' },
	{ id: 'environmental', label: 'Environment', icon: Leaf, color: '#166534', bg: '#DCFCE7' },
	{ id: 'violence', label: 'Safety', icon: Shield, color: '#1E3A8A', bg: '#EFF6FF', sensitive: true },
	{ id: 'police_issue', label: 'Misconduct', icon: Scale, color: '#374151', bg: '#F3F4F6', sensitive: true },
];

export function getCategory(id: string): CategoryConfig {
	return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export const SENSITIVE_CATEGORIES = new Set(CATEGORIES.filter((c) => c.sensitive).map((c) => c.id));
