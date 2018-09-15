import { connect } from "react-redux";
import React from "react";
import classnames from "classnames";

import { isEventRemovingSelector } from "./eventsState";
import { socketEmit } from "../state/socket-io-middleware";
import MaterialIcon from "./MaterialIcon";

const connectEventBoxToRedux = connect(
  (state, props) => {
    if (props.type.startsWith("[MARKED_AS_DELETE]___"))
      return { status: "removed" };
    if (isEventRemovingSelector(state, props.id))
      return { status: "removePending" };

    return { status: "active" };
  },
  (dispatch, props) => ({
    onRemoveButtonClick: () =>
      dispatch(
        socketEmit({
          type: "EVENT_DEACTIVATED",
          payload: props.id
        })
      ),
    onRestoreButtonClick: () =>
      dispatch(
        socketEmit({
          type: "EVENT_REACTIVATED",
          payload: props.id
        })
      ),
    onDeleteForeverButtonClick: () =>
      dispatch(
        socketEmit({
          type: "EVENT_DELETED",
          payload: props.id
        })
      )
  })
);

const TimelineEventBox = ({
  id,
  payload,
  type,
  meta,
  status,
  onRemoveButtonClick,
  onRestoreButtonClick,
  onDeleteForeverButtonClick
}) => (
  <div className={classnames("event", status)}>
    <header>
      {status === "removed" ? (
        <code>
          <del>({type.split("[MARKED_AS_DELETE]___").join("")})</del>
        </code>
      ) : (
        <code>{type}</code>
      )}
      {status === "removed" && (
        <React.Fragment>
          <span className="action" onClick={onRestoreButtonClick}>
            <MaterialIcon>restore</MaterialIcon>
          </span>
          <span className="action" onClick={onDeleteForeverButtonClick}>
            <MaterialIcon>delete_forever</MaterialIcon>
          </span>
        </React.Fragment>
      )}
      {status === "active" && (
        <span className="action" onClick={onRemoveButtonClick}>
          <MaterialIcon>remove_circle</MaterialIcon>
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

      .removePending {
        background: #bdbdbd;
        color: rgba(255, 255, 255, 0.86);
      }

      .removePending .payload {
        color: rgba(255, 255, 255, 0.57);
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
        opacity: 0;
        padding-left: 12px;
        cursor: pointer;
      }

      .event:hover .action {
        opacity: 1;
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
        display: flex;
        flex-direction: row;
        align-items: center;
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
