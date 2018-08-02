import { connect } from 'react-redux';
import { distanceInWordsToNow } from 'date-fns';
import { transparentize } from 'polished';
import React from 'react';
import ms from 'ms';

import { cloneEvent } from './dispatcher.state';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import Time from './Time';

const connectToRedux = connect(
  null,
  (dispatch, props) => ({
    clone: () => {
      dispatch(cloneEvent(props.event));
    },
  })
);

const EventDetailBox = ({ event, clone }) => (
  <section>
    <header>
      <h3>
        {event.type} (id: {event.id})
      </h3>
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

    <footer>
      <PrimaryButton onClick={clone}>Copy</PrimaryButton>
      <SecondaryButton>Jump</SecondaryButton>
    </footer>

    <style jsx>{`
      section {
        display: flex;
        flex-direction: column;
        padding: 8px;
      }
      header {
        display: flex;
        flex-direction: column;
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
        background: ${transparentize(1 / 7, '#dcedc8')};
        border-radius: 16px;
      }

      footer {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        margin-top: -8px;
      }
    `}</style>
  </section>
);

export default connectToRedux(EventDetailBox);
