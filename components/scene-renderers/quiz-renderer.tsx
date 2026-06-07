'use client';

import { useState, useCallback } from 'react';
import type { QuizContent } from '@/lib/types/stage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuizRendererProps {
  readonly content: QuizContent;
  readonly mode: 'autonomous' | 'playback';
  readonly sceneId: string;
}

export function QuizRenderer({ content, mode, sceneId: _sceneId }: QuizRendererProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  const handleSingleChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleMultipleChange = (questionId: string, value: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[] | undefined) ?? [];
      const next = checked ? [...current, value] : current.filter((v) => v !== value);
      return { ...prev, [questionId]: next.sort() };
    });
  };

  const handleSubmit = useCallback(() => {
    let correct = 0;
    let total = 0;
    for (const q of content.questions) {
      if (q.hasAnswer === false) continue;
      total++;
      const userAnswer = answers[q.id];
      const correctAnswer = q.answer ?? [];
      if (q.type === 'single') {
        if (userAnswer === correctAnswer[0]) correct++;
      } else if (q.type === 'multiple') {
        const ua = (userAnswer as string[] | undefined) ?? [];
        if (ua.length === correctAnswer.length && ua.every((v) => correctAnswer.includes(v))) {
          correct++;
        }
      }
    }
    setScore({ correct, total });
    setSubmitted(true);
  }, [answers, content.questions]);

  return (
    <div className="w-full h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{'Quiz'}</h1>
        {content.questions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="text-lg">{question.question}</CardTitle>
            </CardHeader>
            <CardContent>
              {(question.type === 'single' || question.type === 'multiple') && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => {
                    const optionValue = typeof option === 'string' ? option : option.value;
                    const optionLabel = typeof option === 'string' ? option : option.label;
                    const letterPrefix = String.fromCharCode(65 + optIndex);

                    if (question.type === 'multiple') {
                      const selected = ((answers[question.id] as string[] | undefined) ?? []).includes(
                        optionValue || letterPrefix,
                      );
                      return (
                        <label
                          key={`${question.id}-opt-${optIndex}`}
                          className={cn(
                            'flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-muted',
                            selected && 'bg-muted',
                            submitted && (question.answer ?? []).includes(optionValue || letterPrefix) && 'bg-emerald-50',
                          )}
                        >
                          <input
                            type="checkbox"
                            value={optionValue || letterPrefix}
                            checked={selected}
                            disabled={submitted}
                            onChange={(e) =>
                              handleMultipleChange(question.id, optionValue || letterPrefix, e.target.checked)
                            }
                            className="size-4"
                          />
                          <span>
                            {letterPrefix}. {optionLabel}
                          </span>
                        </label>
                      );
                    }

                    const selected = answers[question.id] === (optionValue || letterPrefix);
                    return (
                      <label
                        key={`${question.id}-opt-${optIndex}`}
                        className={cn(
                          'flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-muted',
                          selected && 'bg-muted',
                          submitted && (question.answer ?? [])[0] === (optionValue || letterPrefix) && 'bg-emerald-50',
                        )}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={optionValue || letterPrefix}
                          checked={selected}
                          disabled={submitted}
                          onChange={(e) => handleSingleChange(question.id, e.target.value)}
                          className="size-4"
                        />
                        <span>
                          {letterPrefix}. {optionLabel}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {question.type === 'short_answer' && (
                <textarea
                  className="w-full min-h-24 p-2 border rounded"
                  placeholder="Enter your answer..."
                  value={(answers[question.id] as string | undefined) || ''}
                  disabled={submitted}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                  }
                />
              )}
              {submitted && question.analysis && (
                <p className="mt-2 text-sm text-muted-foreground">{question.analysis}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {mode === 'autonomous' && !submitted && (
          <div className="flex justify-end">
            <Button onClick={handleSubmit}>Submit Answers</Button>
          </div>
        )}
        {submitted && score && (
          <div className="text-right space-y-2">
            <p className="text-lg font-semibold">
              Score: {score.correct} / {score.total}
            </p>
            <Button variant="outline" onClick={() => { setSubmitted(false); setScore(null); setAnswers({}); }}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
