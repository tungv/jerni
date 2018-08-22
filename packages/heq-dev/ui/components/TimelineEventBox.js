import { connect } from "react-redux";
import React from "react";
import classnames from "classnames";

import {
  isEventRemovingSelector,
  markAsRemoving,
  unmarkAsRemoving
} from "./eventsState";
import MaterialIcon from "./MaterialIcon";

const connectEventBoxToRedux = connect(
  (state, props) => ({
    removed: isEventRemovingSelector(state, props.id)
  }),
  (dispatch, props) => ({
    onRemoveButtonClick: () => dispatch(markAsRemoving(props.id)),
    onRestoreButtonClick: () => dispatch(unmarkAsRemoving(props.id))
  })
);

const TimelineEventBox = ({
  id,
  payload,
  type,
  meta,
  removed,
  onRemoveButtonClick,
  onRestoreButtonClick
}) => (
  <div className={classnames("event", { removed })}>
    <header>
      <code>{type}</code>
      {!removed && (
        <span className="action" onClick={onRemoveButtonClick}>
          <MaterialIcon>remove_circle</MaterialIcon>
        </span>
      )}
      {removed && (
        <span className="action" onClick={onRestoreButtonClick}>
          <MaterialIcon>add_circle</MaterialIcon>
        </span>
      )}
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
        user-select: none;
      }

      .removed {
        background: #bdbdbd;
        color: rgba(255, 255, 255, 0.86);
      }

      .removed .payload {
        color: rgba(255, 255, 255, 0.57);
      }

      header {
        display: flex;
        flex-direction: row;
        align-items: center;
      }

      .action {
        display: none;
        padding: 0 12px;
        cursor: pointer;
      }

      .event:hover .action {
        display: block;
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
export default connectEventBoxToRedux(TimelineEventBox);
