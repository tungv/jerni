import { distanceInWordsToNow } from 'date-fns';
import React from 'react';
import ms from 'ms';

import EventBox from './EventBox';
import Time from './Time';

const ActivityBox = ({ events, from, to }) => (
  <div className="activity">
    <header>
      <h4>
        <Time refresh={ms('10s')}>
          {() => distanceInWordsToNow(to, { addSuffix: true })}
        </Time>
      </h4>
      <div className="border" />
    </header>
    {events.map(evt => <EventBox key={evt.id} {...evt} />)}
    <style jsx>{`
      .activity {
        padding: 0 12px;
      }
      header {
        display: flex;
        flex-direction: row;
        align-items: center;
      }
      h4 {
        font-family: 'Open Sans';
        font-size: 18px;
        color: rgba(0, 0, 0, 0.57);
        margin: 6px 0;
      }
      .border {
        flex: 1;
        height: 0;
        margin: 0 0 0 12px;
        border-top: 1px solid rgba(0, 0, 0, 0.14);
      }
    `}</style>
  </div>
);

export default ActivityBox;
