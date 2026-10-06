import { useState } from 'react';

export default function DemoSchedulingGuide({ access, enabled, onNavigate, onOpenStaff, onClose }) {
  const actions = access?.actions || [];
  const manager = actions.includes('demos:manage');
  const canBook = manager || actions.includes('demos:book');
  const presenter = access?.presenterEnabled && actions.includes('demos:present');
  const canPresent = manager || actions.includes('demos:present');
  const [requestedTopic, setRequestedTopic] = useState(manager ? 'setup' : canBook ? 'booking' : presenter ? 'availability' : 'overview');
  const topics = [
    {
      id: 'overview', label: 'Start here', title: 'Find your meetings and updates', section: 'calendar', action: 'Open demonstrations',
      steps: [
        ['Check the calendar', 'Open Demonstrations. Use Day or Week, Today, or Go to date to find a meeting. Filter by presenter or status when needed.'],
        ['Open a meeting', 'Select a calendar entry to see its presenter, client contact, meeting link or address, preparation notes, and change history.'],
        ['Read your notifications', 'Open Notifications for booking and schedule updates. Selecting an update marks it as read and opens the meeting details. Email delivery is not configured.'],
        ['Check your access', 'The calendar and available actions depend on your assigned permissions. Ask an administrator to update them in Staff Management → Create/Edit Staff → Page & Action Permissions.'],
      ],
    },
    ...(canBook ? [{
      id: 'booking', label: 'Book a demo', title: 'Schedule a client demonstration', section: 'calendar', action: 'Open demonstrations',
      steps: [
        ['Start a booking', 'Select Book a demonstration. Choose the date, duration, and presenter. Any presenter lets the system choose an available team member.'],
        ['Choose an available time', 'Select one of the displayed time slots. Slots account for published availability, existing meetings, and the booking rules.'],
        ['Add the client and meeting details', 'Choose an existing client or enter a prospect. Add the contact person, topic, online meeting link or on-site address, and preparation notes.'],
        ['Confirm and check the calendar', 'Select Confirm demonstration. The meeting appears in the calendar, and the salesperson and presenter receive in-app notifications. If the time was just taken, choose another slot.'],
      ],
    }] : []),
    ...(canPresent ? [{
      id: 'availability', label: 'Set availability', title: 'Publish the hours sales can book', section: presenter ? 'availability' : null, action: 'Open My availability',
      steps: [
        ['Enable your presenter profile', manager
          ? 'In Settings, enable Your presenter profile to conduct demonstrations. To enable another team member, assign presenter access and Available for sales bookings in Staff Management.'
          : 'Ask an administrator to assign presenter access and enable Available for sales bookings in Staff Management. My availability appears when your presenter profile is enabled.'],
        ['Set your weekly hours', 'Open My availability. Add or adjust the time windows for each weekday. Remove every window from a day to make that weekday unavailable. Suggested hours are not bookable until you publish them.'],
        ['Change or close a specific date', 'Under Changes for a specific date, choose the date and Close the entire day or Set available hours. Select Add date change to add it to your draft.'],
        ['Publish your changes', 'Select Publish availability to save weekly hours and date changes. Existing confirmed meetings are protected: arrange to reschedule, reassign, or cancel conflicts before closing their reserved time.'],
      ],
    }] : []),
    ...(canBook || canPresent ? [{
      id: 'changes', label: 'Meeting follow-up', title: 'Update a meeting and record its outcome', section: 'calendar', action: 'Open demonstrations',
      steps: [
        ['Open the meeting details', 'Select the meeting in Demonstrations or open its notification. Check the current schedule and presenter before making a change.'],
        ['Reschedule or reassign', 'For an upcoming meeting you are authorized to change, select Reschedule / reassign, choose a presenter and available slot, then Confirm new schedule.'],
        ['Cancel when necessary', 'Select Cancel demonstration and add a reason if helpful. Confirm the cancellation to release the reserved time and notify the salesperson and presenter.'],
        ['Record the outcome', 'After the meeting ends, its presenter or an administrator can select Mark completed or Mark no-show. Add outcome and follow-up notes, then save.'],
      ],
    }] : []),
    ...(manager ? [{
      id: 'setup', label: 'Admin setup', title: 'Get the demonstration team ready', section: 'settings', action: 'Open settings',
      steps: [
        ['Assign staff permissions', 'In Staff Management, create or edit an active staff account with a portal login. Enable Demo Scheduling and assign the actions they need: booking, presenting, viewing the team calendar, or managing the module.'],
        ['Choose the bookable presenters', 'For demonstration staff, enable presenter access and Available for sales bookings. Administrators can enable their own presenter profile in Demo Scheduling → Settings.'],
        ['Have presenters publish their hours', 'Each presenter opens My availability, sets weekly hours and any closed dates, and selects Publish availability. Enabling a presenter alone does not publish their schedule.'],
        ['Enable bookings and save the rules', 'Open Settings → Booking rules. Review durations, the buffer, minimum advance notice, and booking window. Enable Allow new bookings and rescheduling, then Save booking rules.'],
      ],
    }] : []),
  ];
  const topic = topics.find(item => item.id === requestedTopic) || topics[0];
  const active = access?.active === true;

  return <div className="demo-guide">
    <p className="demo-guide-intro">Choose a topic for the steps you need. All dates and times use Philippine time (PHT · UTC+8).</p>
    <nav className="demo-guide-nav" aria-label="Scheduling guide topics">
      {topics.map(item => <button type="button" key={item.id} aria-pressed={topic.id === item.id} onClick={() => setRequestedTopic(item.id)}>{item.label}</button>)}
    </nav>
    <section aria-labelledby="demo-guide-topic-title">
      <h3 id="demo-guide-topic-title">{topic.title}</h3>
      <ol className="demo-guide-steps" role="list">
        {topic.steps.map(([title, description], index) => <li key={title}>
          <span className="demo-guide-number" aria-hidden="true">{index + 1}</span>
          <div><h4>{title}</h4><p>{description}</p></div>
        </li>)}
      </ol>
    </section>
    <section className="demo-guide-faq" aria-labelledby="demo-guide-help-title">
      <h4 id="demo-guide-help-title">If something is missing</h4>
      <details><summary>Why is booking paused or the booking button unavailable?</summary><p>{enabled ? 'Booking is enabled. The booking button also needs booking permission and a successfully loaded calendar. Try Refresh if the calendar is still loading or shows an error.' : 'An administrator must enable Allow new bookings and rescheduling in Settings → Booking rules, then save the rules.'} If you need booking permission, ask an administrator to assign it in Staff Management.</p></details>
      <details><summary>Why are there no available time slots?</summary><p>Try a different date, duration, or presenter. A presenter must publish their availability, and the slot must fit the meeting duration, buffer, advance notice, and booking window. Existing meetings and closed dates can also remove slots.</p></details>
      <details><summary>Why can’t I see My availability or Settings?</summary><p>My availability requires presenter access and an enabled presenter profile. Settings requires permission to manage Demo Scheduling. Staff permissions are assigned in Staff Management.</p></details>
    </section>
    <div className="demo-form-footer">
      <div className="demo-inline-actions">
        {active && topic.section && <button type="button" onClick={() => onNavigate(topic.section)}>{topic.action}</button>}
        {active && topic.id === 'setup' && onOpenStaff && <button type="button" onClick={onOpenStaff}>Open Staff Management</button>}
      </div>
      <button type="button" className="demo-primary" onClick={onClose}>Got it</button>
    </div>
  </div>;
}
