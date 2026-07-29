'use client';

import { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getDomainsForStage, isOpenDomainStage, type ProfileStage } from '@/lib/onboarding/catalog';
import { normalizeCustomDomain } from '@/lib/onboarding/form-state';
import type { DomainRef } from '@/lib/onboarding/types';

export function ProfileChoice({
  label,
  selected,
  onClick,
  disabled = false,
  className,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full touch-manipulation cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
        selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <span className="min-w-0 break-words">{label}</span>
      {selected && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}
    </button>
  );
}

function domainKey(domain: DomainRef): string {
  return domain.source === 'catalog'
    ? `catalog:${domain.id}`
    : `custom:${domain.name.toLowerCase()}`;
}

export function DomainPicker({
  label,
  stage,
  value,
  onChange,
}: {
  label: string;
  stage: ProfileStage;
  value: DomainRef[];
  onChange: (value: DomainRef[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [customValue, setCustomValue] = useState('');
  const isOpen = isOpenDomainStage(stage);
  const catalog = getDomainsForStage(stage);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return catalog;
    return catalog.filter(
      (item) =>
        item.label.toLocaleLowerCase().includes(query) ||
        item.id.toLocaleLowerCase().includes(query),
    );
  }, [catalog, search]);

  function toggle(domain: DomainRef) {
    const key = domainKey(domain);
    onChange(
      value.some((item) => domainKey(item) === key)
        ? value.filter((item) => domainKey(item) !== key)
        : value.length < 12
          ? [...value, domain]
          : value,
    );
  }

  function addCustom() {
    const domain = normalizeCustomDomain(customValue, value);
    if (!domain || value.length >= 12) return;
    onChange([...value, domain]);
    setCustomValue('');
  }

  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-medium text-foreground">{label}</legend>
      {isOpen && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${label}-${stage}-search`}
              className="mb-1.5 block text-sm text-muted-foreground"
            >
              搜索建议领域
            </label>
            <Input
              id={`${label}-${stage}-search`}
              value={search}
              className="min-h-11"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor={`${label}-${stage}-custom`}
              className="mb-1.5 block text-sm text-muted-foreground"
            >
              添加自定义领域
            </label>
            <div className="flex gap-2">
              <Input
                id={`${label}-${stage}-custom`}
                value={customValue}
                maxLength={40}
                className="min-h-11 min-w-0"
                onChange={(event) => setCustomValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustom();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0"
                disabled={!customValue.trim()}
                onClick={addCustom}
              >
                <Plus />
                添加领域
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((item) => {
          const domain: DomainRef = { source: 'catalog', id: item.id, name: item.label };
          return (
            <ProfileChoice
              key={item.id}
              label={item.label}
              selected={value.some((selected) => domainKey(selected) === domainKey(domain))}
              onClick={() => toggle(domain)}
            />
          );
        })}
        {value
          .filter((domain) => domain.source === 'custom')
          .map((domain) => (
            <ProfileChoice
              key={domainKey(domain)}
              label={domain.name}
              selected
              onClick={() => toggle(domain)}
            />
          ))}
      </div>
      {isOpen && filtered.length === 0 && value.every((domain) => domain.source !== 'custom') && (
        <p className="mt-2 text-sm text-muted-foreground">
          没有匹配的建议领域，可以直接添加自定义领域。
        </p>
      )}
    </fieldset>
  );
}
