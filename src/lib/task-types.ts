/**
 * CRM task types and the Google Calendar hand-off.
 *
 * Kept React-free so the calendar-URL construction can be tested.
 */

/** Must mirror CrmTaskType in FojiApi. Order is the order shown in pickers. */
export const TASK_TYPES = [
  "Call",
  "Meeting",
  "Presentation",
  "Visit",
  "FollowUp",
  "Email",
  "WhatsApp",
  "General",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

/** Default duration for a task that only has a due date, not a time range. */
const DEFAULT_EVENT_MINUTES = 60;

/** Google's template URL wants basic-format UTC: 20260815T140000Z. */
function toGoogleStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Build a "add to Google Calendar" link for a task.
 *
 * Deliberately a prefilled template URL rather than an API write: the event
 * belongs on the assignee's own calendar, and this needs no OAuth, no stored
 * token, and works even when the agent has no calendar connected.
 */
export function googleCalendarUrl(opts: {
  title: string;
  dueAt: string | Date;
  details?: string | null;
  minutes?: number;
}): string {
  const start = opts.dueAt instanceof Date ? opts.dueAt : new Date(opts.dueAt);
  const end = new Date(start.getTime() + (opts.minutes ?? DEFAULT_EVENT_MINUTES) * 60_000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${toGoogleStamp(start)}/${toGoogleStamp(end)}`,
  });
  if (opts.details?.trim()) params.set("details", opts.details.trim());

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
