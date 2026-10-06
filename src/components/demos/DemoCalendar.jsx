import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { demoToday, shiftDemoDate, formatDemoDate, formatDemoTime } from '../../utils/demoScheduling';

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
          {meetings.length === 0 ? <p className="demo-day-empty">No demonstrations</p> : meetings.map(booking => <button className={`demo-calendar-meeting demo-status-${booking.status}`} key={booking.id} onClick={() => onOpen(booking.id)}><span>{formatDemoTime(booking.startAt)}–{formatDemoTime(booking.endAt)}</span><strong>{booking.clientName}</strong><small>{booking.topic}</small><small>{booking.presenterName}</small><span className="demo-status">{booking.status.replaceAll('_', ' ')}</span></button>)}
        </section>;
      })}
    </div>}
    {!loading && bookings.length === 0 && <div className="demo-empty"><CalendarBlank size={32} /><h3>Your calendar is clear</h3><p>Confirmed demonstrations will appear here. Sales can book from the team’s published availability.</p></div>}
  </>;
}
