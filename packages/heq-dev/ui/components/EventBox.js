import React from 'react';

const EventBox = ({ id, payload, type, meta }) => (
  <div className="event">
    <header>
      <code>{type}</code>
      <code className="payload">{JSON.stringify(payload)}</code>
      <span className="spacer" />
      <code>id: {id}</code>
    </header>
    <style jsx>{`
      .event {
        display: flex;
        flex-direction: column;
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
        color: rgba(0, 0, 0, 0.86);
        white-space: nowrap;
      }

      .payload {
        padding-left: 12px;
        color: rgba(0, 0, 0, 0.54);
        max-width: 450px;

        overflow: hidden;
        text-overflow: ellipsis;
      }
    `}</style>
  </div>
);

export default EventBox;
