import { connect } from 'react-redux';
import React from 'react';
import ms from 'ms';

import ActivityBox from './ActivityBox';

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

    const activityGap = ms('1m');

    // should go to same group
    if (lastActivity.to + activityGap > occurredAt) {
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
  <section>
    <h3>Events</h3>
    {activities.map(activity => (
      <ActivityBox
        key={activity.from}
        from={activity.from}
        to={activity.to}
        events={activity.events}
      />
    ))}
    <style jsx>{`
      section {
        padding: 8px;
      }
      h3 {
        margin: 8px;
        font-family: 'Open Sans';
      }
    `}</style>
  </section>
);

export default connectToRedux(EventsTimeline);
