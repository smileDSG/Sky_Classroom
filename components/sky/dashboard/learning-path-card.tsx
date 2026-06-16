'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Route, Loader2, ArrowRight, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LearningPath, LearningPathNode } from '@/lib/teaching/learning-path-types';

interface LearningPathCardProps {
  onStartTopic?: (topic: string) => void;
}

function getNodeStatusIcon(node: LearningPathNode) {
  if (node.status === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (node.status === 'in_progress') {
    return <PlayCircle className="h-4 w-4 text-indigo-500" />;
  }
  return <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />;
}

function getNodeStatusColor(status: LearningPathNode['status']) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500';
    case 'in_progress':
      return 'bg-indigo-500';
    default:
      return 'bg-slate-200 dark:bg-slate-700';
  }
}

export function LearningPathCard({ onStartTopic }: LearningPathCardProps) {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/sky/learning-path', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.path) {
          setPath(j.data.path);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/sky/learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setPath(data.data.path);
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <Route className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">学习路径</span>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </motion.div>
    );
  }

  if (!path) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <Route className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">学习路径</span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          还没有学习路径，让 AI 为你规划一条个性化学习路线吧。
        </p>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Route className="h-3.5 w-3.5 mr-1" />
          )}
          生成学习路径
        </Button>
      </motion.div>
    );
  }

  const completed = path.nodes.filter((n) => n.status === 'completed').length;
  const total = path.nodes.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const nextNode = path.nodes.find((n) => n.status === 'pending' || n.status === 'in_progress');
  const currentNode = path.nodes.find((n) => n.status === 'in_progress');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{path.title}</span>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {completed}/{total} 完成
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* Node list */}
      <div className="space-y-2 mb-4 max-h-[160px] overflow-y-auto pr-1">
        {path.nodes.slice(0, 6).map((node, idx) => (
          <div
            key={node.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
              node.status === 'in_progress'
                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
            )}
          >
            <div className="shrink-0">{getNodeStatusIcon(node)}</div>
            <span
              className={cn(
                'truncate flex-1',
                node.status === 'completed'
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : node.status === 'in_progress'
                    ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-slate-600 dark:text-slate-300',
              )}
            >
              {node.topic}
            </span>
            {node.masteryAfter !== undefined && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                掌握度 {node.masteryAfter}%
              </span>
            )}
          </div>
        ))}
        {path.nodes.length > 6 && (
          <p className="text-xs text-slate-400 text-center">还有 {path.nodes.length - 6} 个节点...</p>
        )}
      </div>

      {/* Next action */}
      {nextNode && onStartTopic && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStartTopic(nextNode.topic)}
          className="w-full text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:text-indigo-700"
        >
          <ArrowRight className="h-3.5 w-3.5 mr-1" />
          {currentNode ? `继续学习：${currentNode.topic}` : `开始学习：${nextNode.topic}`}
        </Button>
      )}
    </motion.div>
  );
}
