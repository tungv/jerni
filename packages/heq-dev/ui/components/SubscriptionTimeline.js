import { connect } from "react-redux";
import React from "react";

import { socketEmit } from "../state/socket-io-middleware";
import PrimaryButton from "./PrimaryButton";
import PulseBlock from "./PulseBlock";
import TimelineSpine from "./TimelineSpine";

const connectSubScriptionTimeline = connect(
  state => ({
    stream: state.pulses
  }),
  {
    onRefreshButtonClick: () =>
      socketEmit({
        type: "RELOAD"
      })
  }
);

const SubscriptionTimeline = ({ stream, onRefreshButtonClick }) => (
  <main>
    <PrimaryButton onClick={onRefreshButtonClick}>Reload</PrimaryButton>
    <CurrentBlock />
    {stream.map(pulse => (
      <PulseBlock
        key={pulse.events[0].id}
        events={pulse.events}
        models={pulse.models}
      />
    ))}
    <style jsx>{`
      main {
        display: flex;
        flex-direction: column;
      }
    `}</style>
  </main>
);

const CurrentBlock = () => (
  <section>
    <div className="left" />
    <TimelineSpine />
    <div className="right">now</div>
    <style jsx>{`
      section {
        width: 100%;
        position: relative;
        font-family: "Roboto Slab";
        display: flex;
        flex-direction: row;
      }

      div {
        box-sizing: border-box;
        padding: 6px 12px;
      }

      .left {
        width: 480px;
      }

      .right {
        flex: 1;
      }
    `}</style>
  </section>
);

export default connectSubScriptionTimeline(SubscriptionTimeline);
