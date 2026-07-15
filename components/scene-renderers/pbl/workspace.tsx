'use client';

import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import type { PBLProjectConfig } from '@/lib/pbl/types';
import { IssueboardPanel } from './issueboard-panel';
import { ChatPanel } from './chat-panel';
import { usePBLChat } from './use-pbl-chat';
import { PBLGuidePanel } from './guide';

interface PBLWorkspaceProps {
  readonly projectConfig: PBLProjectConfig;
  readonly userRole: string;
  readonly onConfigUpdate: (config: PBLProjectConfig) => void;
  readonly onReset: () => void;
}

export function PBLWorkspace({
  projectConfig,
  userRole,
  onConfigUpdate,
  onReset,
}: PBLWorkspaceProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [issuesExpanded, setIssuesExpanded] = useState(true);

  const { messages, isLoading, sendMessage, currentIssue } = usePBLChat({
    projectConfig,
    userRole,
    onConfigUpdate,
  });

  return (
    <div className="flex h-full w-full flex-col md:flex-row">
      {/* Left: Issueboard */}
      <div
        className={`
          flex flex-col overflow-hidden border-b bg-background md:w-[35%] md:min-w-[280px] md:border-b-0 md:border-r
          ${issuesExpanded ? 'h-[45%] md:h-auto' : 'h-auto md:h-auto'}
        `}
      >
        {/* Back button bar */}
        <div className="flex items-center gap-1.5 px-3 pt-2">
          {!showConfirm ? (
            <div className="flex flex-1 items-center gap-1">
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{'重新开始'}</span>
              </button>
              <div className="ml-auto">
                <PBLGuidePanel />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{'确定重置进度？'}</span>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  onReset();
                }}
                className="rounded bg-destructive px-2 py-0.5 text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                {'确定'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded bg-muted px-2 py-0.5 transition-colors hover:bg-muted/80"
              >
                {'取消'}
              </button>
            </div>
          )}
          <button
            onClick={() => setIssuesExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted md:hidden"
            aria-label={issuesExpanded ? '收起任务看板' : '展开任务看板'}
          >
            {issuesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        <div className={`flex-1 overflow-hidden ${issuesExpanded ? 'block' : 'hidden md:block'}`}>
          <IssueboardPanel issueboard={projectConfig.issueboard} />
        </div>
      </div>

      {/* Right: Chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatPanel
          messages={messages}
          currentIssue={currentIssue}
          userRole={userRole}
          isLoading={isLoading}
          onSendMessage={sendMessage}
        />
      </div>
    </div>
  );
}
