import { connect } from 'react-redux';
import Link from 'next/link';
import React from 'react';
import classnames from 'classnames';

const connectToRedux = connect((state, props) => ({
  selected: state.selectedEvent === props.id,
}));

const EventBox = ({ id, payload, type, meta, selected }) => (
  <div className={classnames('event', { selected })}>
    <Link
      href={{
        pathname: '.',
        query: {
          eventId: id,
        },
      }}
    >
      <header>
        <code>{type}</code>
        <code className="payload">{JSON.stringify(payload)}</code>
        <span className="spacer" />
        <code>id: {id}</code>
      </header>
    </Link>
    <style jsx>{`
      .event {
        display: flex;
        flex-direction: column;
        padding: 2px 12px;
        color: rgba(0, 0, 0, 0.86);
      }

      .selected {
        background: #0091ea;
        color: rgba(255, 255, 255, 0.86);
      }

      .selected .payload {
        color: rgba(255, 255, 255, 0.57);
      }

      header {
        display: flex;
        flex-direction: row;
        align-items: center;
      }

      .spacer {
        flex: 1;
        height: 1px;
        margin: 0 12px;
      }

      code {
        font-family: 'Overpass Mono', monospace;
        font-size: 18px;
        white-space: nowrap;
      }

      .payload {
        padding-left: 12px;
        color: rgba(0, 0, 0, 0.57);
        max-width: 450px;

        overflow: hidden;
        text-overflow: ellipsis;
      }
    `}</style>
  </div>
);

export default connectToRedux(EventBox);
