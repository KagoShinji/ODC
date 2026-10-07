import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { demoToday, shiftDemoDate, formatDemoDate, formatDemoTime } from '../../utils/demoScheduling';
import DemoStatusBadge from './DemoStatusBadge';

const bookingTone = {
  confirmed: '!border-sky-400/25 !border-l-sky-300 !bg-sky-400/5 [&>span:first-child]:!text-sky-300',
  completed: '!border-emerald-400/25 !border-l-emerald-300 !bg-emerald-400/5 [&>span:first-child]:!text-emerald-300',
  cancelled: '!border-rose-400/25 !border-l-rose-300 !bg-rose-400/5 [&>span:first-child]:!text-rose-300',
  no_show: '!border-amber-400/25 !border-l-amber-300 !bg-amber-400/5 [&>span:first-child]:!text-amber-300',
};

export default function DemoCalendar({ start, view, date, onDateChange, onViewChange, bookings, loading, truncated, onOpen }) {
  const days = Array.from({ length: view === 'week' ? 7 : 1 }, (_, index) => shiftDemoDate(start, index));
  return <>
    <div className="demo-calendar-toolbar">
      <div className="demo-date-navigation"><button aria-label="Previous period" onClick={() => onDateChange(shiftDemoDate(date, view === 'week' ? -7 : -1))}><CaretLeft size={17} /></button><button onClick={() => onDateChange(demoToday())}>Today</button><button aria-label="Next period" onClick={() => onDateChange(shiftDemoDate(date, view === 'week' ? 7 : 1))}><CaretRight size={17} /></button><label className="demo-date-picker">Go to date<input type="date" value={date} onChange={e => { if (e.target.value) onDateChange(e.target.value); }} /></label></div>
      <div className="demo-inline-actions"><button aria-pressed={view === 'day'} onClick={() => onViewChange('day')}>Day</button><button aria-pressed={view === 'week'} onClick={() => onViewChange('week')}>Week</button></div>
    </div>
    {truncated && <p className="demo-notice">This range contains more than 200 demonstrations. Switch to day view to see a smaller range.</p>}
    {loading ? <div role="status" aria-label="Loading demonstrations"><div className="demo-skeleton" /><div className="demo-skeleton" /></div> : <div className={`demo-calendar ${view === 'day' ? 'demo-calendar-day' : ''}`}>
      {days.map(day => {
        const meetings = bookings.filter(booking => booking.date === day);
        return <section className="demo-calendar-column" key={day} aria-label={formatDemoDate(day, { weekday: 'long', year: 'numeric' })}><header className={day === demoToday() ? 'demo-current-day' : ''}><span>{formatDemoDate(day, { weekday: 'short', month: undefined, day: undefined })}</span><strong>{formatDemoDate(day)}</strong></header>
          {meetings.length === 0 ? <p className="demo-day-empty">No demonstrations</p> : meetings.map(booking => <button className={`demo-calendar-meeting ${bookingTone[booking.status] || ''}`} key={booking.id} onClick={() => onOpen(booking.id)}><span>{formatDemoTime(booking.startAt)}–{formatDemoTime(booking.endAt)}</span><strong>{booking.clientName}</strong><small>{booking.topic}</small><small>{booking.presenterName}</small><DemoStatusBadge status={booking.status} className="w-fit" /></button>)}
        </section>;
      })}
    </div>}
    {!loading && bookings.length === 0 && <div className="demo-empty"><CalendarBlank size={32} /><h3>Your calendar is clear</h3><p>Confirmed demonstrations will appear here. Sales can book from the team’s published availability.</p></div>}
  </>;
}
