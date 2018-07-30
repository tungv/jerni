import { distanceInWordsToNow } from 'date-fns';
import React from 'react';
import ms from 'ms';

import Time from './Time';

const EventDetailBox = ({ event }) => (
  <section>
    <header>
      <h3>{event.type}</h3>
      <span className="spacer" />
      <span>
        {event.meta.occurredAt && (
          <Time refresh={ms('10s')}>
            {() =>
              distanceInWordsToNow(event.meta.occurredAt, { addSuffix: true })
            }
          </Time>
        )}
        {event.meta.client && (
          <span>
            {' '}
            from{' '}
            <strong className="client-detail">
              {event.meta.client}
              {event.meta.clientVersion && (
                <span>@{event.meta.clientVersion}</span>
              )}
            </strong>
          </span>
        )}
      </span>
    </header>
    <pre>{JSON.stringify(event.payload, null, 2)}</pre>

    <style jsx>{`
      section {
        display: flex;
        flex-direction: column;
      }
      header {
        display: flex;
        flex-direction: row;
        font-family: 'Overpass Mono', monospace;
        align-items: center;
        color: rgba(0, 0, 0, 0.86);
      }
      h3 {
        font-size: 24px;
        margin: 0;
      }
      .spacer {
        flex: 1;
        height: 0;
        border-top: 4px dotted rgba(0, 0, 0, 0.14);
        margin: 0 12px;
      }
      .client-detail {
        text-decoration: underline;
      }

      pre {
        font-family: 'Overpass Mono', monospace;
        font-size: 18px;
        padding: 16px;
        background: rgba(0, 0, 0, 0.14);
        border-radius: 16px;
        box-shadow: 0px 3px 10px 1px rgba(0, 0, 0, 0.29);
      }
    `}</style>
  </section>
);

export default EventDetailBox;
