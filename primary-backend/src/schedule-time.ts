export function nextSchedule(
  settings: { frequency: string; hour: number; minute: number },
  now: Date,
): Date {
  if (settings.frequency === "every_5_minutes")
    return new Date((Math.floor(now.getTime() / 300000) + 1) * 300000);
  const next = new Date(now);
  next.setUTCHours(settings.hour, settings.minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
