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
    <h3>Events timeline</h3>
    {activities.length === 0 && <EmptyQueue />}
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
        text-align: center;
        text-transform: uppercase;
      }
    `}</style>
  </section>
);

const EmptyQueue = () => (
  <div>
    <span className="line" />
    <span>this is the beginning of time</span>
    <span className="line" />
    <style jsx>{`
      div {
        padding: 32px;
        font-family: 'Roboto Slab';
        color: rgba(0, 0, 0, 0.54);
        display: flex;
        flex-direction: row;
        align-items: center;
      }

      .line {
        flex: 1;
        height: 0;
        border-top: 1px solid rgba(0, 0, 0, 0.14);
        margin: 8px;
      }
    `}</style>
  </div>
);

export default connectToRedux(EventsTimeline);
