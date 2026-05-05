'use client';

// Calendar UI — day, week, month, year views + event create/edit modal.
//
// Plain English: pick a view, navigate with the prev/next arrows,
// click a day to drop a new event, click an event to edit. Stores
// the active view in the URL so refresh keeps your place.

import { useEffect, useMemo, useState } from 'react';
import {
  calendarEventCategoryLabel,
  calendarEventDefaultColor,
  eventIncludesUser,
  fullName,
  type CalendarEvent,
  type CalendarEventAttendee,
  type CalendarEventCategory,
  type Employee,
} from '@yge/shared';

type ViewType = 'day' | 'week' | 'month' | 'year';

const VIEWS: ViewType[] = ['day', 'week', 'month', 'year'];

export interface KnownUser {
  email: string;
  name: string;
}

interface Props {
  initialEvents: CalendarEvent[];
  today: string;
  apiBaseUrl: string;
  employees: Employee[];
  knownUsers: KnownUser[];
  /** Email of the signed-in user, lowercase. Empty when not signed in
   *  (shouldn't happen since the page is gated, but guarded anyway). */
  currentUserEmail: string;
}

interface DraftEvent {
  id?: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string;
  category: CalendarEventCategory;
  attendees: CalendarEventAttendee[];
}

const CATEGORIES: CalendarEventCategory[] = [
  'GENERAL',
  'JOB',
  'BID_DUE',
  'PAY_PERIOD',
  'INSPECTION',
  'MEETING',
  'PERSONAL',
  'TIME_OFF',
];

// ---- Date helpers --------------------------------------------------------

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - out.getDay());
  return out;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}
function addYears(d: Date, n: number): Date {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + n);
  return out;
}
function sameDay(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}
function fmtDateLong(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function fmtTimeRange(e: CalendarEvent): string {
  if (e.allDay) return 'All day';
  const s = new Date(e.startAt);
  const en = new Date(e.endAt);
  const sStr = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const eStr = en.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${sStr} – ${eStr}`;
}

function eventsOnDate(events: CalendarEvent[], d: Date): CalendarEvent[] {
  const day = ymd(d);
  return events
    .filter((e) => e.startAt.slice(0, 10) <= day && e.endAt.slice(0, 10) >= day)
    .sort((a, b) => {
      // All-day events first, then by start time.
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startAt.localeCompare(b.startAt);
    });
}

// ---- Main wrapper --------------------------------------------------------

export function CalendarView({
  initialEvents,
  today,
  apiBaseUrl,
  employees,
  knownUsers,
  currentUserEmail,
}: Props) {
  const [view, setView] = useState<ViewType>('month');
  const [cursor, setCursor] = useState<Date>(new Date(`${today}T12:00:00`));
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [creatingDraft, setCreatingDraft] = useState<DraftEvent | null>(null);
  /** True = show only events the current user owns or was invited to. */
  const [myOnly, setMyOnly] = useState<boolean>(currentUserEmail !== '');

  const todayDate = useMemo(() => new Date(`${today}T12:00:00`), [today]);

  // Filter events for the active user view. When current user is empty
  // (e.g. dev fallback) we always show everything so the page isn't
  // accidentally blank.
  const visibleEvents = useMemo(() => {
    if (!myOnly || !currentUserEmail) return events;
    return events.filter((e) => eventIncludesUser(e, currentUserEmail));
  }, [events, myOnly, currentUserEmail]);

  function navigate(delta: number) {
    if (view === 'day') setCursor(addDays(cursor, delta));
    else if (view === 'week') setCursor(addDays(cursor, delta * 7));
    else if (view === 'month') setCursor(addMonths(cursor, delta));
    else if (view === 'year') setCursor(addYears(cursor, delta));
  }

  function openCreate(date: Date, hour?: number) {
    const start = new Date(date);
    if (hour !== undefined) {
      start.setHours(hour, 0, 0, 0);
    } else {
      start.setHours(9, 0, 0, 0);
    }
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    // Pre-seed the creating user as an attendee so the event lands on
    // their own filtered calendar by default.
    const seedAttendees: CalendarEventAttendee[] = [];
    if (currentUserEmail) {
      const me = knownUsers.find(
        (u) => u.email.toLowerCase() === currentUserEmail.toLowerCase(),
      );
      if (me) {
        seedAttendees.push({
          kind: 'USER',
          ref: me.email.toLowerCase(),
          name: me.name,
          status: 'ACCEPTED',
        });
      }
    }
    setCreatingDraft({
      title: '',
      description: '',
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay: false,
      location: '',
      category: 'GENERAL',
      attendees: seedAttendees,
    });
  }

  async function refetchEvents(from: Date, to: Date) {
    try {
      const url =
        `${apiBaseUrl}/api/calendar-events?` +
        new URLSearchParams({ from: ymd(from), to: ymd(to) }).toString();
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as { events?: CalendarEvent[] };
      setEvents(body.events ?? []);
    } catch {
      // Network blip — leave existing events on screen rather than
      // replacing with [].
    }
  }

  // Refetch when navigating outside the initial 15-month window.
  useEffect(() => {
    const from = addMonths(cursor, -3);
    const to = addMonths(cursor, 3);
    void refetchEvents(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  async function saveEvent(draft: DraftEvent): Promise<void> {
    const body = {
      title: draft.title,
      description: draft.description || undefined,
      startAt: draft.startAt,
      endAt: draft.endAt,
      allDay: draft.allDay,
      location: draft.location || undefined,
      category: draft.category,
      attendees: draft.attendees,
      ...(currentUserEmail && !draft.id
        ? { createdByUserId: currentUserEmail.toLowerCase() }
        : {}),
    };
    if (draft.id) {
      const res = await fetch(
        `${apiBaseUrl}/api/calendar-events/${draft.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
      const json = (await res.json()) as { event: CalendarEvent };
      setEvents((prev) => prev.map((e) => (e.id === json.event.id ? json.event : e)));
    } else {
      const res = await fetch(`${apiBaseUrl}/api/calendar-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
      const json = (await res.json()) as { event: CalendarEvent };
      setEvents((prev) => [...prev, json.event]);
    }
  }

  async function deleteEvent(id: string): Promise<void> {
    const res = await fetch(`${apiBaseUrl}/api/calendar-events/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-4">
      <Toolbar
        view={view}
        cursor={cursor}
        todayDate={todayDate}
        myOnly={myOnly}
        showFilter={Boolean(currentUserEmail)}
        onViewChange={setView}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => setCursor(todayDate)}
        onNew={() => openCreate(cursor)}
        onToggleMyOnly={() => setMyOnly(!myOnly)}
      />

      {view === 'day' && (
        <DayView
          cursor={cursor}
          events={visibleEvents}
          todayDate={todayDate}
          onCreate={(hour) => openCreate(cursor, hour)}
          onEventClick={setEditing}
        />
      )}
      {view === 'week' && (
        <WeekView
          cursor={cursor}
          events={visibleEvents}
          todayDate={todayDate}
          onCreate={(date, hour) => openCreate(date, hour)}
          onEventClick={setEditing}
        />
      )}
      {view === 'month' && (
        <MonthView
          cursor={cursor}
          events={visibleEvents}
          todayDate={todayDate}
          onCreate={openCreate}
          onEventClick={setEditing}
        />
      )}
      {view === 'year' && (
        <YearView
          cursor={cursor}
          events={visibleEvents}
          todayDate={todayDate}
          onPickMonth={(d) => {
            setCursor(d);
            setView('month');
          }}
        />
      )}

      {(creatingDraft || editing) && (
        <EventModal
          initial={
            editing
              ? {
                  id: editing.id,
                  title: editing.title,
                  description: editing.description ?? '',
                  startAt: editing.startAt,
                  endAt: editing.endAt,
                  allDay: editing.allDay ?? false,
                  location: editing.location ?? '',
                  category: editing.category,
                  attendees: editing.attendees ?? [],
                }
              : creatingDraft!
          }
          employees={employees}
          knownUsers={knownUsers}
          onClose={() => {
            setEditing(null);
            setCreatingDraft(null);
          }}
          onSave={async (draft) => {
            await saveEvent(draft);
            setEditing(null);
            setCreatingDraft(null);
          }}
          onDelete={
            editing
              ? async () => {
                  await deleteEvent(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

// ---- Toolbar -------------------------------------------------------------

function Toolbar({
  view,
  cursor,
  todayDate,
  myOnly,
  showFilter,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onNew,
  onToggleMyOnly,
}: {
  view: ViewType;
  cursor: Date;
  todayDate: Date;
  myOnly: boolean;
  showFilter: boolean;
  onViewChange: (v: ViewType) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNew: () => void;
  onToggleMyOnly: () => void;
}) {
  let title = '';
  if (view === 'day') title = fmtDateLong(cursor);
  else if (view === 'week') {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    title = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } else if (view === 'month') title = fmtMonthYear(cursor);
  else if (view === 'year') title = String(cursor.getFullYear());

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <span className="text-base text-gray-600">— {title}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showFilter && (
          <div className="inline-flex rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={onToggleMyOnly}
              className={`px-3 py-1.5 text-xs font-medium first:rounded-l-md ${myOnly ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              My events
            </button>
            <button
              type="button"
              onClick={onToggleMyOnly}
              className={`px-3 py-1.5 text-xs font-medium last:rounded-r-md ${!myOnly ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              All
            </button>
          </div>
        )}
        <div className="inline-flex rounded-md border border-gray-300 bg-white">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`px-3 py-1.5 text-xs font-medium first:rounded-l-md last:rounded-r-md ${view === v ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              {v === 'day' ? 'Day' : v === 'week' ? 'Week' : v === 'month' ? 'Month' : 'Year'}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-md border border-gray-300 bg-white">
          <button
            type="button"
            onClick={onPrev}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            aria-label="Previous"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onToday}
            className="border-x border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onNext}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            aria-label="Next"
          >
            →
          </button>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          + New event
        </button>
      </div>
    </div>
  );
}

// ---- Day view ------------------------------------------------------------

function DayView({
  cursor,
  events,
  todayDate,
  onCreate,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEvent[];
  todayDate: Date;
  onCreate: (hour: number) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const dayEvents = eventsOnDate(events, cursor);
  const allDay = dayEvents.filter((e) => e.allDay);
  const timed = dayEvents.filter((e) => !e.allDay);
  const isToday = sameDay(cursor, todayDate);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div
        className={`border-b border-gray-200 px-4 py-2 text-sm font-semibold ${isToday ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`}
      >
        {fmtDateLong(cursor)}
      </div>
      {allDay.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            All day
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allDay.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onEventClick(e)}
                className={`rounded px-2 py-1 text-xs font-medium ${e.color ?? calendarEventDefaultColor(e.category)} hover:opacity-80`}
              >
                {e.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        {Array.from({ length: 24 }, (_, hour) => {
          const hourEvents = timed.filter((e) => {
            const h = new Date(e.startAt).getHours();
            return h === hour;
          });
          return (
            <div
              key={hour}
              className="grid grid-cols-[80px_1fr] items-stretch border-b border-gray-100 last:border-0"
            >
              <div className="border-r border-gray-100 px-2 py-1 text-right text-[11px] text-gray-500">
                {hour === 0
                  ? '12 AM'
                  : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                      ? '12 PM'
                      : `${hour - 12} PM`}
              </div>
              <button
                type="button"
                onClick={() => hourEvents.length === 0 && onCreate(hour)}
                className="min-h-[36px] px-3 py-1 text-left hover:bg-gray-50"
              >
                {hourEvents.length === 0 ? (
                  <span className="text-xs text-gray-300">+ Add</span>
                ) : (
                  <div className="space-y-1">
                    {hourEvents.map((e) => (
                      <div
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onEventClick(e);
                        }}
                        className={`cursor-pointer rounded px-2 py-1 text-xs ${e.color ?? calendarEventDefaultColor(e.category)} hover:opacity-80`}
                      >
                        <div className="font-medium">{e.title}</div>
                        <div className="text-[10px] opacity-70">{fmtTimeRange(e)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Week view -----------------------------------------------------------

function WeekView({
  cursor,
  events,
  todayDate,
  onCreate,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEvent[];
  todayDate: Date;
  onCreate: (date: Date, hour: number) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <div className="grid min-w-[800px] grid-cols-[60px_repeat(7,1fr)]">
        <div className="border-b border-r border-gray-200 bg-gray-50 px-1 py-2 text-center text-[10px] font-semibold text-gray-500">
          {' '}
        </div>
        {days.map((d) => {
          const isToday = sameDay(d, todayDate);
          return (
            <div
              key={ymd(d)}
              className={`border-b border-r border-gray-200 px-2 py-2 text-center last:border-r-0 ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}
            >
              <div className="text-[10px] uppercase text-gray-500">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </div>
              <div
                className={`text-base ${isToday ? 'font-bold text-blue-900' : 'font-semibold text-gray-900'}`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}

        {/* All-day band */}
        <div className="border-b border-r border-gray-200 px-1 py-2 text-right text-[10px] text-gray-500">
          all day
        </div>
        {days.map((d) => {
          const allDay = eventsOnDate(events, d).filter((e) => e.allDay);
          return (
            <div
              key={ymd(d) + '-allday'}
              className="min-h-[28px] border-b border-r border-gray-200 px-1 py-1 last:border-r-0"
            >
              <div className="space-y-0.5">
                {allDay.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onEventClick(e)}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${e.color ?? calendarEventDefaultColor(e.category)} hover:opacity-80`}
                    title={e.title}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Hour rows */}
        {Array.from({ length: 24 }, (_, hour) => (
          <RowFragment
            key={hour}
            hour={hour}
            days={days}
            events={events}
            todayDate={todayDate}
            onCreate={onCreate}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}

function RowFragment({
  hour,
  days,
  events,
  todayDate,
  onCreate,
  onEventClick,
}: {
  hour: number;
  days: Date[];
  events: CalendarEvent[];
  todayDate: Date;
  onCreate: (date: Date, hour: number) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  return (
    <>
      <div className="border-b border-r border-gray-100 px-1 py-1 text-right text-[10px] text-gray-500">
        {hour === 0
          ? '12a'
          : hour < 12
            ? `${hour}a`
            : hour === 12
              ? '12p'
              : `${hour - 12}p`}
      </div>
      {days.map((d) => {
        const isToday = sameDay(d, todayDate);
        const hourEvents = eventsOnDate(events, d).filter(
          (e) => !e.allDay && new Date(e.startAt).getHours() === hour,
        );
        return (
          <button
            key={ymd(d) + '-' + hour}
            type="button"
            onClick={() => hourEvents.length === 0 && onCreate(d, hour)}
            className={`min-h-[32px] border-b border-r border-gray-100 px-1 py-0.5 text-left last:border-r-0 ${isToday ? 'bg-blue-50/30' : 'bg-white'} hover:bg-gray-50`}
          >
            <div className="space-y-0.5">
              {hourEvents.map((e) => (
                <div
                  key={e.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEventClick(e);
                  }}
                  className={`cursor-pointer truncate rounded px-1 py-0.5 text-[10px] ${e.color ?? calendarEventDefaultColor(e.category)} hover:opacity-80`}
                  title={`${e.title} — ${fmtTimeRange(e)}`}
                >
                  {e.title}
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </>
  );
}

// ---- Month view ----------------------------------------------------------

function MonthView({
  cursor,
  events,
  todayDate,
  onCreate,
  onEventClick,
}: {
  cursor: Date;
  events: CalendarEvent[];
  todayDate: Date;
  onCreate: (date: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  // 6 rows × 7 cols = 42 cells; covers any month.
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {weekdayNames.map((w) => (
          <div
            key={w}
            className="border-r border-gray-200 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600 last:border-r-0"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, todayDate);
          const dayEvents = eventsOnDate(events, d);
          const visible = dayEvents.slice(0, 3);
          const more = dayEvents.length - visible.length;
          const isLastRow = i >= 35;
          return (
            <button
              key={ymd(d)}
              type="button"
              onClick={() => onCreate(d)}
              className={`min-h-[100px] border-b border-r border-gray-200 p-1.5 text-left last:border-r-0 ${i % 7 === 6 ? 'border-r-0' : ''} ${isLastRow ? 'border-b-0' : ''} ${inMonth ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/40`}
            >
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? 'bg-blue-700 font-bold text-white' : inMonth ? 'font-semibold text-gray-900' : 'text-gray-400'}`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {visible.map((e) => (
                  <div
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick(e);
                    }}
                    className={`cursor-pointer truncate rounded px-1 py-0.5 text-[11px] ${e.color ?? calendarEventDefaultColor(e.category)} hover:opacity-80`}
                    title={`${e.title} — ${fmtTimeRange(e)}`}
                  >
                    {e.allDay ? '' : `${new Date(e.startAt).getHours() % 12 || 12}${new Date(e.startAt).getHours() < 12 ? 'a' : 'p'} `}
                    {e.title}
                  </div>
                ))}
                {more > 0 && (
                  <div className="px-1 text-[11px] text-gray-500">+{more} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Year view -----------------------------------------------------------

function YearView({
  cursor,
  events,
  todayDate,
  onPickMonth,
}: {
  cursor: Date;
  events: CalendarEvent[];
  todayDate: Date;
  onPickMonth: (d: Date) => void;
}) {
  const year = cursor.getFullYear();
  const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1));
  const weekdayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Pre-compute set of dates that have any event for fast lookup.
  const datesWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const start = new Date(e.startAt);
      const end = new Date(e.endAt);
      const d = new Date(start);
      while (d <= end) {
        set.add(ymd(d));
        d.setDate(d.getDate() + 1);
      }
    }
    return set;
  }, [events]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map((m) => {
        const start = startOfMonth(m);
        const gridStart = startOfWeek(start);
        const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
        return (
          <button
            key={m.getMonth()}
            type="button"
            onClick={() => onPickMonth(m)}
            className="rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-blue-400 hover:shadow"
          >
            <div className="mb-2 text-sm font-semibold text-gray-900">
              {m.toLocaleDateString(undefined, { month: 'long' })}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center text-[10px]">
              {weekdayInitials.map((w, i) => (
                <div key={i} className="text-gray-400">
                  {w}
                </div>
              ))}
              {cells.map((d) => {
                const inMonth = d.getMonth() === m.getMonth();
                const isToday = sameDay(d, todayDate);
                const has = datesWithEvents.has(ymd(d));
                return (
                  <div
                    key={ymd(d)}
                    className={`relative aspect-square rounded text-[10px] leading-none ${isToday ? 'bg-blue-700 font-bold text-white' : inMonth ? 'text-gray-900' : 'text-gray-300'}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      {d.getDate()}
                    </span>
                    {has && inMonth && !isToday && (
                      <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-600"></span>
                    )}
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- Event modal ---------------------------------------------------------

function toLocalDatetimeInput(iso: string): string {
  // <input type="datetime-local"> wants 'YYYY-MM-DDTHH:mm' in local time.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalDatetimeInput(local: string): string {
  // Convert local input back to UTC ISO.
  if (!local) return '';
  const d = new Date(local);
  return d.toISOString();
}

function EventModal({
  initial,
  employees,
  knownUsers,
  onClose,
  onSave,
  onDelete,
}: {
  initial: DraftEvent;
  employees: Employee[];
  knownUsers: KnownUser[];
  onClose: () => void;
  onSave: (draft: DraftEvent) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftEvent>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!draft.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (new Date(draft.endAt).getTime() < new Date(draft.startAt).getTime()) {
      setError('End time must be after start time.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...draft, title: draft.title.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm('Delete this event?')) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {draft.id ? 'Edit event' : 'New event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Title</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              autoFocus
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Pre-bid walk for Sulphur Springs"
            />
          </label>

          <div className="flex items-center gap-2 text-sm">
            <input
              id="all-day"
              type="checkbox"
              checked={draft.allDay}
              onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })}
            />
            <label htmlFor="all-day" className="font-medium text-gray-700">
              All day
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Start</span>
              <input
                type={draft.allDay ? 'date' : 'datetime-local'}
                value={
                  draft.allDay
                    ? draft.startAt.slice(0, 10)
                    : toLocalDatetimeInput(draft.startAt)
                }
                onChange={(e) => {
                  const v = draft.allDay
                    ? new Date(`${e.target.value}T00:00:00`).toISOString()
                    : fromLocalDatetimeInput(e.target.value);
                  setDraft({ ...draft, startAt: v });
                }}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">End</span>
              <input
                type={draft.allDay ? 'date' : 'datetime-local'}
                value={
                  draft.allDay
                    ? draft.endAt.slice(0, 10)
                    : toLocalDatetimeInput(draft.endAt)
                }
                onChange={(e) => {
                  const v = draft.allDay
                    ? new Date(`${e.target.value}T23:59:59`).toISOString()
                    : fromLocalDatetimeInput(e.target.value);
                  setDraft({ ...draft, endAt: v });
                }}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Category</span>
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as CalendarEventCategory })
              }
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {calendarEventCategoryLabel(c)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Location</span>
            <input
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Yard / job site / Zoom link"
            />
          </label>

          <AttendeePicker
            attendees={draft.attendees}
            employees={employees}
            knownUsers={knownUsers}
            onChange={(next) => setDraft({ ...draft, attendees: next })}
          />

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Notes</span>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="text-sm text-red-700 hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {busy ? 'Saving…' : draft.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Attendee picker ----------------------------------------------------

function AttendeePicker({
  attendees,
  employees,
  knownUsers,
  onChange,
}: {
  attendees: CalendarEventAttendee[];
  employees: Employee[];
  knownUsers: KnownUser[];
  onChange: (next: CalendarEventAttendee[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Build the unified candidate list (USERs first, then active EMPLOYEEs).
  const candidates = useMemo(() => {
    const userRows = knownUsers.map((u) => ({
      kind: 'USER' as const,
      ref: u.email.toLowerCase(),
      name: u.name,
      key: `USER:${u.email.toLowerCase()}`,
      role: 'Login user',
    }));
    const empRows = employees
      .filter((e) => e.status === 'ACTIVE')
      .map((e) => ({
        kind: 'EMPLOYEE' as const,
        ref: e.id,
        name: fullName(e),
        key: `EMPLOYEE:${e.id}`,
        role: e.role || 'Employee',
      }));
    return [...userRows, ...empRows];
  }, [employees, knownUsers]);

  // Filter by query and exclude already-added attendees.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const taken = new Set(attendees.map((a) => `${a.kind}:${a.ref.toLowerCase()}`));
    return candidates
      .filter((c) => !taken.has(`${c.kind}:${c.ref.toLowerCase()}`))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [candidates, query, attendees]);

  function add(c: (typeof candidates)[number]) {
    onChange([
      ...attendees,
      { kind: c.kind, ref: c.ref, name: c.name, status: 'INVITED' },
    ]);
    setQuery('');
  }

  function remove(idx: number) {
    onChange(attendees.filter((_, i) => i !== idx));
  }

  return (
    <div className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">People</span>
      <div className="rounded border border-gray-300 bg-white p-2">
        <div className="flex flex-wrap gap-1">
          {attendees.length === 0 ? (
            <span className="px-1 py-0.5 text-xs text-gray-400">
              No one tagged yet.
            </span>
          ) : (
            attendees.map((a, i) => (
              <span
                key={`${a.kind}:${a.ref}`}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${a.kind === 'USER' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}
                title={a.kind === 'USER' ? 'Login user' : 'Employee'}
              >
                {a.name}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${a.name}`}
                  className="ml-1 text-gray-500 hover:text-gray-900"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="self-start rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              + Add person
            </button>
          ) : (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                autoFocus
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <div className="max-h-44 overflow-y-auto rounded border border-gray-200 bg-white">
                {filtered.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-gray-400">
                    No matches.
                  </div>
                ) : (
                  <ul>
                    {filtered.map((c) => (
                      <li key={c.key}>
                        <button
                          type="button"
                          onClick={() => add(c)}
                          className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">
                            {c.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${c.kind === 'USER' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}
                          >
                            {c.kind === 'USER' ? 'User' : c.role}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                }}
                className="self-start text-[11px] text-gray-500 hover:underline"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
