import { connect } from 'react-redux';
import React from 'react';
import ms from 'ms';

const groupActivitiesByTime = events => {
  const groups = events.reduce((activities, evt) => {
    const occurredAt = evt.meta.occurredAt;

    if (activities.length === 0) {
      return [
        {
          events: [evt],
          from: occurredAt,
          to: occurredAt,
        },
      ];
    }

    const lastActivity = activities[0];

    const fiveMinutes = ms('1m');

    // should go to same group
    if (lastActivity.to + fiveMinutes > occurredAt) {
      return [
        {
          events: [evt, ...lastActivity.events],
          from: lastActivity.from,
          to: occurredAt,
        },
        ...activities.slice(1),
      ];
    }

    // should go to next group
    return [
      {
        events: [evt],
        from: occurredAt,
        to: occurredAt,
      },
      ...activities,
    ];
  }, []);

  return groups;
};

const connectToRedux = connect(state => ({
  activities: groupActivitiesByTime(state.events),
}));

const EventsTimeline = ({ activities }) => (
  <div>
    <h3>events</h3>
    {activities.map(activity => (
      <div className="activity" key={activity.from}>
        {activity.events.map(evt => (
          <div className="event" key={evt.id}>
            <code>{evt.id}</code>
            <code>{evt.type}</code>
          </div>
        ))}
      </div>
    ))}

    <style jsx>{`
      .activity {
        margin: 12px;
        background: cyan;
      }
    `}</style>
  </div>
);

export default connectToRedux(EventsTimeline);
