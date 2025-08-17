// Canonical OCD categories metadata used across the app
// Single source of truth for icon/color per canonical category

import { CanonicalCategory, CANONICAL_CATEGORIES } from '@/utils/categoryMapping';

export interface CanonicalCategoryMeta {
  id: CanonicalCategory;
  icon: string; // MaterialCommunityIcons name or emoji key depending on usage context
  color: string; // hex color
}

const DEFAULT_COLOR = '#6B7280';

export const CANONICAL_CATEGORY_META: Record<CanonicalCategory, CanonicalCategoryMeta> = {
  contamination: { id: 'contamination', icon: 'hand-wash', color: '#3B82F6' },
  checking: { id: 'checking', icon: 'lock-check', color: '#10B981' },
  symmetry: { id: 'symmetry', icon: 'shape-outline', color: '#8B5CF6' },
  mental: { id: 'mental', icon: 'head-cog', color: '#EC4899' },
  hoarding: { id: 'hoarding', icon: 'package-variant', color: '#F59E0B' },
  other: { id: 'other', icon: 'help-circle', color: '#6B7280' },
};

export function getCanonicalCategoryMeta(id: string): CanonicalCategoryMeta {
  const key = (id || 'other') as CanonicalCategory;
  return CANONICAL_CATEGORY_META[key] || CANONICAL_CATEGORY_META.other;
}

export function getCanonicalCategoryColor(id: string): string {
  return getCanonicalCategoryMeta(id).color || DEFAULT_COLOR;
}

export function getCanonicalCategoryIconName(id: string): string {
  return getCanonicalCategoryMeta(id).icon;
}


