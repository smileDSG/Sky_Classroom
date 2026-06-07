/**
 * Environment Validator
 *
 * Validates required environment variables and configuration on startup.
 * Returns structured results for display or logging.
 */

// ==================== Types ====================

export type EnvCheckStatus = 'ok' | 'warning' | 'error';

export interface EnvCheck {
  name: string;
  status: EnvCheckStatus;
  message: string;
}

export interface EnvValidationResult {
  passed: boolean;
  checks: EnvCheck[];
  summary: string;
}

// ==================== Known Providers ====================

const LLM_PROVIDERS = [
  'OPENAI', 'ANTHROPIC', 'GOOGLE', 'DEEPSEEK', 'QWEN', 'KIMI',
  'MINIMAX', 'GLM', 'SILICONFLOW', 'DOUBAO', 'OPENROUTER', 'GROK',
  'TENCENT', 'XIAOMI', 'OLLAMA', 'LEMONADE',
] as const;

// ==================== Implementation ====================

export function validateEnvironment(): EnvValidationResult {
  const checks: EnvCheck[] = [];

  // 1. DEFAULT_MODEL
  const defaultModel = process.env.DEFAULT_MODEL;
  if (defaultModel) {
    const [provider] = defaultModel.split(':');
    const hasKey = LLM_PROVIDERS.some(
      (p) => p.toLowerCase() === provider?.toLowerCase(),
    );
    checks.push({
      name: 'DEFAULT_MODEL',
      status: hasKey ? 'ok' : 'warning',
      message: hasKey
        ? `Using default model: ${defaultModel}`
        : `DEFAULT_MODEL set to "${defaultModel}" but no matching provider key found`,
    });
  } else {
    checks.push({
      name: 'DEFAULT_MODEL',
      status: 'warning',
      message:
        'DEFAULT_MODEL not set. Server-side generation will fail unless clients specify a model.',
    });
  }

  // 2. Check at least one LLM provider has API key
  const configuredLLMs = LLM_PROVIDERS.filter((p) => process.env[`${p}_API_KEY`]);
  if (configuredLLMs.length === 0) {
    checks.push({
      name: 'LLM Providers',
      status: 'error',
      message:
        'No LLM provider API keys configured. Set at least one *_API_KEY environment variable.',
    });
  } else {
    checks.push({
      name: 'LLM Providers',
      status: 'ok',
      message: `${configuredLLMs.length} LLM provider(s) configured: ${configuredLLMs.join(', ')}`,
    });
  }

  // 3. Check for ACCESS_CODE (optional, but warn if on public deployment)
  const accessCode = process.env.ACCESS_CODE;
  checks.push({
    name: 'ACCESS_CODE',
    status: accessCode ? 'ok' : 'warning',
    message: accessCode
      ? 'Access code protection enabled'
      : 'ACCESS_CODE not set — site is publicly accessible without authentication',
  });

  // 4. NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  checks.push({
    name: 'NODE_ENV',
    status: nodeEnv === 'production' ? 'ok' : 'ok',
    message: `Running in ${nodeEnv} mode`,
  });

  // 5. Check for ALLOW_LOCAL_NETWORKS (relevant for self-hosted setups)
  const allowLocal = process.env.ALLOW_LOCAL_NETWORKS === 'true';
  if (allowLocal) {
    checks.push({
      name: 'ALLOW_LOCAL_NETWORKS',
      status: nodeEnv === 'production' ? 'warning' : 'ok',
      message:
        'Local network URLs are allowed — ensure this is intentional for self-hosted deployments',
    });
  }

  const hasErrors = checks.some((c) => c.status === 'error');
  const hasWarnings = checks.some((c) => c.status === 'warning');

  return {
    passed: !hasErrors,
    checks,
    summary: hasErrors
      ? 'Environment has critical errors that will prevent operation'
      : hasWarnings
        ? 'Environment is functional but has warnings'
        : 'Environment is correctly configured',
  };
}
