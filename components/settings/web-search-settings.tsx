'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/lib/store/settings';
import { BAIDU_SUB_SOURCES, WEB_SEARCH_PROVIDERS } from '@/lib/web-search/constants';
import type { BaiduSubSources, WebSearchProviderId } from '@/lib/web-search/types';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';

interface WebSearchSettingsProps {
  selectedProviderId: WebSearchProviderId;
}

export function WebSearchSettings({ selectedProviderId }: WebSearchSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);

  const webSearchProvidersConfig = useSettingsStore((state) => state.webSearchProvidersConfig);
  const setWebSearchProviderConfig = useSettingsStore((state) => state.setWebSearchProviderConfig);
  const baiduSubSources = useSettingsStore((state) => state.baiduSubSources);
  const setBaiduSubSources = useSettingsStore((state) => state.setBaiduSubSources);

  const provider = WEB_SEARCH_PROVIDERS[selectedProviderId];
  const isServerConfigured = !!webSearchProvidersConfig[selectedProviderId]?.isServerConfigured;
  const showCredentialFields = true;

  const buildRequestUrl = (baseUrl: string) => {
    const trimmed = baseUrl.replace(/\/$/, '');
    if (!provider.endpointPath) return trimmed;
    if (trimmed.endsWith(provider.endpointPath)) return trimmed;
    return `${trimmed}${provider.endpointPath}`;
  };

  // Reset showApiKey when provider changes (derived state pattern)
  const [prevSelectedProviderId, setPrevSelectedProviderId] = useState(selectedProviderId);
  if (selectedProviderId !== prevSelectedProviderId) {
    setPrevSelectedProviderId(selectedProviderId);
    setShowApiKey(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Server-configured notice */}
      {isServerConfigured && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm text-blue-700 dark:text-blue-300">
          {'管理员已在服务端配置了此提供方的 API Key，可直接使用。也可输入自己的 Key 覆盖。'}
        </div>
      )}

      {!provider.requiresApiKey && !isServerConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-300">
          {'API Key 为可选项。未填写时将通过公开页面抓取获取结果。'}
        </div>
      )}

      {/* API Key + Base URL Configuration */}
      {showCredentialFields && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">{'搜索 API Key'}</Label>
              <div className="relative">
                <Input
                  name={`web-search-api-key-${selectedProviderId}`}
                  type={showApiKey ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={
                    isServerConfigured
                      ? '可选，留空则使用服务端配置'
                      : !provider.requiresApiKey
                        ? '可选，留空则使用服务端配置'
                        : '输入 API Key'
                  }
                  value={webSearchProvidersConfig[selectedProviderId]?.apiKey || ''}
                  onChange={(e) =>
                    setWebSearchProviderConfig(selectedProviderId, {
                      apiKey: e.target.value,
                    })
                  }
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {'从所选搜索服务商获取 API Key，用于网络搜索'}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">{'Base URL'}</Label>
              <Input
                name={`web-search-base-url-${selectedProviderId}`}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={provider.defaultBaseUrl || ''}
                value={webSearchProvidersConfig[selectedProviderId]?.baseUrl || ''}
                onChange={(e) =>
                  setWebSearchProviderConfig(selectedProviderId, {
                    baseUrl: e.target.value,
                  })
                }
                className="text-sm"
              />
            </div>
          </div>

          {/* Request URL Preview */}
          {(() => {
            const effectiveBaseUrl =
              webSearchProvidersConfig[selectedProviderId]?.baseUrl ||
              provider.defaultBaseUrl ||
              '';
            if (!effectiveBaseUrl) return null;
            const fullUrl = buildRequestUrl(effectiveBaseUrl);
            return (
              <p className="text-xs text-muted-foreground break-all">
                {'请求地址'}: {fullUrl}
              </p>
            );
          })()}
        </>
      )}

      {selectedProviderId === 'baidu' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">{'百度搜索源'}</Label>
            <p className="text-xs text-muted-foreground">{'选择至少一个百度数据源参与搜索。'}</p>
          </div>

          <div className="space-y-2">
            {(
              Object.entries(BAIDU_SUB_SOURCES) as Array<
                [keyof BaiduSubSources, (typeof BAIDU_SUB_SOURCES)[keyof typeof BAIDU_SUB_SOURCES]]
              >
            ).map(([key, meta]) => {
              const enabled = baiduSubSources[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta.description}
                      {meta.docsUrl && (
                        <a
                          href={meta.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 ml-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                        >
                          {'API 文档'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => setBaiduSubSources({ [key]: checked })}
                    aria-label={meta.label}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
