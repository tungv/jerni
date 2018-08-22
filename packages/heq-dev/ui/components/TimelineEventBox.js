import React from "react";
import classnames from "classnames";

const TimelineEventBox = ({ id, payload, type, meta, selected }) => (
  <div className={classnames("event", { selected })}>
    <header>
      <code>{type}</code>
      <span className="spacer" />
      <code>id: {id}</code>
    </header>
    <main>
      <code className="payload">{JSON.stringify(payload)}</code>
    </main>
    <style jsx>{`
      .event {
        display: flex;
        flex-direction: column;
        color: rgba(0, 0, 0, 0.86);
        background: #dcedc8;
        border-radius: 4px;
        margin: 6px 0;
        padding: 12px;
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
        font-family: "Overpass Mono", monospace;
        font-size: 18px;
        white-space: nowrap;
      }

      main {
        position: relative;
      }
      .payload {
        display: block;
        color: rgba(0, 0, 0, 0.57);
        width: 100%;

        overflow: hidden;
        text-overflow: ellipsis;
      }
    `}</style>
  </div>
);
export default TimelineEventBox;
