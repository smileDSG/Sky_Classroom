const DEFAULT_LEARNER_TIME_ZONE = 'Asia/Shanghai';

const learnerDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DEFAULT_LEARNER_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function planningDateFromInstant(value: Date): Date {
  const parts = learnerDateFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Failed to resolve learner planning date');
  }

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
