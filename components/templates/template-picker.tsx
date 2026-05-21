/**
 * Template picker modal — browse and select built-in templates.
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CourseTemplate } from '@/lib/templates/types';
import { getBuiltInTemplates, searchTemplates } from '@/lib/templates/registry';

const SUBJECTS = [
  { key: 'all', label: 'All', icon: '📚' },
  { key: 'math', label: 'Math', icon: '📐' },
  { key: 'physics', label: 'Physics', icon: '⚡' },
  { key: 'chemistry', label: 'Chemistry', icon: '🧪' },
  { key: 'english', label: 'English', icon: '📖' },
] as const;

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: CourseTemplate) => void;
}

export function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const [subject, setSubject] = useState('all');
  const [query, setQuery] = useState('');

  const allTemplates = getBuiltInTemplates();
  const filtered = subject === 'all'
    ? allTemplates
    : allTemplates.filter((t) => t.subject === subject);
  const results = query ? searchTemplates(query) : filtered;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create from Template</DialogTitle>
          <DialogDescription>Choose a pre-built course template to get started quickly</DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search templates..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Tabs value={subject} onValueChange={setSubject}>
          <TabsList className="mb-4">
            {SUBJECTS.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>
                {s.icon} {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((template) => (
            <Card key={template.id} className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <CardTitle className="text-base">{template.nameZh}</CardTitle>
                    <CardDescription>{template.name}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{template.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-secondary px-2 py-1 rounded capitalize">{template.subject}</span>
                  {template.grade && (
                    <span className="text-xs bg-secondary px-2 py-1 rounded">{template.grade}</span>
                  )}
                  <span className="text-xs bg-secondary px-2 py-1 rounded">{template.outline.length} scenes</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button size="sm" className="w-full" onClick={() => onSelect(template)}>
                  Use Template
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {results.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No templates found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
