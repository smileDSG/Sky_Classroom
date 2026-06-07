/**
 * Prompt Version Manager
 *
 * Supports:
 * - Version registration with semantic versioning
 * - A/B test creation with traffic splitting
 * - Resolving which version to serve per request
 * - Metric collection for A/B evaluation
 */

import type {
  PromptVersion,
  PromptVersionMeta,
  ABTestConfig,
  ABTestMetrics,
  IVersionManager,
} from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('VersionManager');

// ==================== In-memory Store ====================

class VersionStore {
  private versions = new Map<string, PromptVersion[]>();
  private abTests = new Map<string, ABTestConfig>();
  private metrics = new Map<string, ABTestMetrics>();

  // Versions
  addVersion(version: PromptVersion): void {
    const existing = this.versions.get(version.promptId) || [];
    // Index by `id` (unique identifier for a version entry)
    const idx = existing.findIndex((v) => v.id === version.id);
    if (idx >= 0) {
      existing[idx] = version;
    } else {
      existing.push(version);
    }
    this.versions.set(version.promptId, existing);
  }

  getVersion(promptId: string, versionId: string): PromptVersion | null {
    // Look up by PromptVersion.id (e.g. "v1", "v1.0.0") or by version string (e.g. "1.0.0")
    const candidates = this.versions.get(promptId) || [];
    return candidates.find((v) => v.id === versionId || v.version === versionId) || null;
  }

  listVersions(promptId: string): PromptVersion[] {
    return this.versions.get(promptId) || [];
  }

  getLatestVersion(promptId: string): PromptVersion | null {
    const versions = this.versions.get(promptId);
    if (!versions || versions.length === 0) return null;
    return versions.reduce((a, b) =>
      compareSemver(a.version, b.version) > 0 ? a : b,
    );
  }

  // A/B Tests
  addABTest(config: ABTestConfig): void {
    this.abTests.set(config.promptId, config);
  }

  getABTest(promptId: string): ABTestConfig | null {
    return this.abTests.get(promptId) || null;
  }

  listABTests(): ABTestConfig[] {
    return Array.from(this.abTests.values());
  }

  // Metrics
  getMetrics(abTestId: string): ABTestMetrics | null {
    return this.metrics.get(abTestId) || null;
  }

  recordMetric(abTestId: string, variant: 'A' | 'B', data: Record<string, unknown>): void {
    let m = this.metrics.get(abTestId);
    if (!m) {
      m = {
        variantA: { calls: 0 },
        variantB: { calls: 0 },
      };
    }
    const target = variant === 'A' ? m.variantA : m.variantB;
    target.calls++;
    if (data.tokenUsage !== undefined) {
      target.avgTokenUsage =
        ((target.avgTokenUsage || 0) * (target.calls - 1) + (data.tokenUsage as number)) /
        target.calls;
    }
    if (data.score !== undefined) {
      target.avgScore =
        ((target.avgScore || 0) * (target.calls - 1) + (data.score as number)) /
        target.calls;
    }
    this.metrics.set(abTestId, m);
  }

  clear(): void {
    this.versions.clear();
    this.abTests.clear();
    this.metrics.clear();
  }
}

// ==================== Semantic Version Comparator ====================

function compareSemver(a: string, b: string): number {
  const parse = (v: string) => {
    const parts = v.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
    };
  };
  const va = parse(a);
  const vb = parse(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

// ==================== Version Manager Implementation ====================

export class VersionManager implements IVersionManager {
  private store = new VersionStore();

  registerVersion(version: PromptVersion): void {
    this.store.addVersion(version);
    log.info(`Registered version: ${version.promptId}@${version.version}`);
  }

  getVersion(promptId: string, version: string): PromptVersion | null {
    return this.store.getVersion(promptId, version);
  }

  listVersions(promptId: string): PromptVersion[] {
    return this.store.listVersions(promptId);
  }

  getLatestVersion(promptId: string): PromptVersion | null {
    return this.store.getLatestVersion(promptId);
  }

  resolveVersion(promptId: string, _language?: string): string | null {
    // Check for active A/B test
    const abTest = this.store.getABTest(promptId);
    if (abTest && abTest.enabled) {
      const useVariantB = Math.random() < abTest.trafficSplit;
      const versionId = useVariantB ? abTest.variantB : abTest.variantA;
      // Resolve versionId (e.g. "v1.0.0") back to the actual version string (e.g. "1.0.0")
      const variant = this.store.getVersion(promptId, versionId);
      const versionStr = variant?.version || versionId;
      log.debug(
        `A/B test ${abTest.id}: resolved to ${useVariantB ? 'B' : 'A'} (${versionStr})`,
      );
      return versionStr;
    }

    // No A/B test → use latest
    const latest = this.store.getLatestVersion(promptId);
    return latest?.version || null;
  }

  createABTest(config: ABTestConfig): void {
    if (config.trafficSplit < 0 || config.trafficSplit > 1) {
      throw new Error('trafficSplit must be between 0 and 1');
    }
    this.store.addABTest(config);
    log.info(`Created A/B test: ${config.id} for ${config.promptId} (split: ${config.trafficSplit})`);
  }

  getABTest(promptId: string): ABTestConfig | null {
    return this.store.getABTest(promptId);
  }

  listABTests(): ABTestConfig[] {
    return this.store.listABTests();
  }

  recordMetric(abTestId: string, variant: 'A' | 'B', data: Record<string, unknown>): void {
    this.store.recordMetric(abTestId, variant, data);
  }

  getMetrics(abTestId: string): ABTestMetrics | null {
    return this.store.getMetrics(abTestId);
  }

  clear(): void {
    this.store.clear();
  }
}

// ==================== Singleton ====================

let _versionManager: VersionManager | null = null;

export function getVersionManager(): VersionManager {
  if (!_versionManager) {
    _versionManager = new VersionManager();
  }
  return _versionManager;
}

export function resetVersionManager(): void {
  _versionManager?.clear();
  _versionManager = null;
}
