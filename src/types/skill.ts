export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  version: string;
  installCount: number;
  rating: number;
  isOfficial: boolean;
  isNew: boolean;
  createdAt: string;
  features: string[];
  configSchema?: SkillConfigField[];
  docsUrl?: string;
}

export interface SkillConfigField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  default?: unknown;
  options?: string[];
  required?: boolean;
  description?: string;
}

export type SortBy = 'downloads' | 'rating' | 'newest' | 'name';

export interface SkillFilters {
  sortBy: SortBy;
  isOfficial: boolean;
  isNew: boolean;
}
