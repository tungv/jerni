import { connect } from "react-redux";
import React from "react";
import classnames from "classnames";

import { clearRemovingList } from "./eventsState";
import { socketEmit } from "../state/socket-io-middleware";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

const connectToRedux = connect(
  state => ({
    idArray: state.removingEventIds
  }),
  {
    sendRemove: idArray =>
      socketEmit({
        type: "SERVER:EVENTS_REMOVED",
        payload: idArray
      }),

    onCancelButtonClick: clearRemovingList
  },
  ({ idArray }, { sendRemove, ...others }) => ({
    count: idArray.length,
    onRemoveButtonClick: () => sendRemove(idArray),
    ...others
  })
);

const RemoveEventConfirmBox = ({
  count,
  onRemoveButtonClick,
  onCancelButtonClick
}) => (
  <section className={classnames({ hidden: count === 0 })}>
    <div>
      <span>
        You are going to remove{" "}
        <strong>
          {count} event{count <= 1 ? "" : "s"}
        </strong>
        <br />
        <em>this can only be done in development mode</em>
      </span>
      <SecondaryButton onClick={onCancelButtonClick}>Cancel</SecondaryButton>
      <PrimaryButton onClick={onRemoveButtonClick}>Remove</PrimaryButton>
    </div>
    <style jsx>{`
      section {
        position: fixed;
        bottom: 12px;
        width: 100%;
        left: 0;
        right: 0;
        height: 84px;
        z-index: 9999; /* this needs to be higher than any events stack */

        display: flex;
        flex-direction: row;
        align-items: center;
        transition: 300ms ease-out;
      }

      .hidden {
        bottom: -96px;
      }

      div {
        margin: auto;
        background: rgba(0, 0, 0, 0.87);
        color: rgba(255, 255, 255, 0.87);
        font-family: "Open Sans";
        border-radius: 100px;
        padding: 12px 24px;
        display: flex;
        flex-direction: row;
        align-items: center;
      }
      span {
        padding-right: 24px;
      }
      strong {
        color: white;
      }
    `}</style>
  </section>
);

export default connectToRedux(RemoveEventConfirmBox);
