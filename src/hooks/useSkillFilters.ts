import { useState, useMemo, useCallback } from 'react';
import type { SkillFilters } from '../types/skill';
import { skills, categories } from '../data/skills';

export function useSkillFilters() {
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SkillFilters>({
    sortBy: 'downloads',
    isOfficial: false,
    isNew: false,
  });

  const filteredSkills = useMemo(() => {
    let result = [...skills];

    if (selectedCategory !== '全部') {
      result = result.filter(s => s.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    if (filters.isOfficial) {
      result = result.filter(s => s.isOfficial);
    }

    if (filters.isNew) {
      result = result.filter(s => s.isNew);
    }

    switch (filters.sortBy) {
      case 'downloads':
        result.sort((a, b) => b.installCount - a.installCount);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        break;
    }

    return result;
  }, [selectedCategory, searchQuery, filters]);

  const updateFilters = useCallback((updates: Partial<SkillFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    skills: filteredSkills,
    allSkills: skills,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    filters,
    updateFilters,
  };
}
