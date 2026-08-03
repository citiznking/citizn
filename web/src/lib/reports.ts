export const REPORT_CATEGORIES = [
  { value: 'road', label: 'Road' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'school', label: 'School' },
  { value: 'traffic', label: 'Traffic infrastructure' },
  { value: 'power', label: 'Power' },
  { value: 'water', label: 'Water' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'environmental', label: 'Environmental (flooding, erosion, waste, pollution)' },
  { value: 'violence', label: 'Violence / insecurity' },
  { value: 'police_issue', label: 'Police / security-service issue' },
] as const;

export const REPORT_SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

export interface PublishedReport {
  id: string;
  category: string;
  severity: string;
  description: string | null;
  geom: { type: 'Point'; coordinates: [number, number] } | null;
  status: string;
  lifecycle: string;
  created_at: string;
}
