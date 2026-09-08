import { describe, it, expect } from 'vitest';
import { universalSolverTemplate } from '@/lib/orchestration/registry/templates/solvers/universal';
import { scienceSolverTemplate } from '@/lib/orchestration/registry/templates/solvers/science';
import { humanitiesSolverTemplate } from '@/lib/orchestration/registry/templates/solvers/humanities';

const allTemplates = [
  universalSolverTemplate,
  scienceSolverTemplate,
  humanitiesSolverTemplate,
] as const;

describe('Solver Templates', () => {
  describe('universal template', () => {
    it('has all required fields', () => {
      expect(universalSolverTemplate).toHaveProperty('id');
      expect(universalSolverTemplate).toHaveProperty('name');
      expect(universalSolverTemplate).toHaveProperty('persona');
      expect(universalSolverTemplate).toHaveProperty('guidelines');
      expect(universalSolverTemplate).toHaveProperty('subjects');
      expect(universalSolverTemplate).toHaveProperty('style');

      expect(typeof universalSolverTemplate.id).toBe('string');
      expect(typeof universalSolverTemplate.name).toBe('string');
      expect(typeof universalSolverTemplate.persona).toBe('string');
      expect(Array.isArray(universalSolverTemplate.guidelines)).toBe(true);
      expect(Array.isArray(universalSolverTemplate.subjects)).toBe(true);
      expect(typeof universalSolverTemplate.style).toBe('string');
    });
  });

  describe('science template', () => {
    it('subjects are science subjects', () => {
      expect(scienceSolverTemplate.subjects).toContain('数学');
      expect(scienceSolverTemplate.subjects).toContain('物理');
      expect(scienceSolverTemplate.subjects).toContain('化学');
      expect(scienceSolverTemplate.style).toBe('detailed');
    });
  });

  describe('humanities template', () => {
    it('uses heuristic style', () => {
      expect(humanitiesSolverTemplate.style).toBe('heuristic');
    });
  });

  describe('id uniqueness', () => {
    it('all templates have unique ids', () => {
      const ids = allTemplates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('guidelines', () => {
    it('guidelines arrays are non-empty', () => {
      for (const template of allTemplates) {
        expect(template.guidelines.length).toBeGreaterThan(0);
      }
    });
  });

  describe('subject isolation', () => {
    it('no subject overlap between science and humanities', () => {
      const scienceSubjects = new Set(scienceSolverTemplate.subjects);
      const intersection = humanitiesSolverTemplate.subjects.filter((s) => scienceSubjects.has(s));
      expect(intersection).toEqual([]);
    });
  });
});
