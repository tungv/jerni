import { connect } from "react-redux";
import React from "react";

import PulseBlock from "./PulseBlock";
import TimelineSpine from "./TimelineSpine";

const connectSubScriptionTimeline = connect(state => ({
  stream: state.pulses
}));

const SubscriptionTimeline = ({ stream, onRefreshButtonClick }) => (
  <main>
    <CurrentBlock />
    {stream
      .filter(pulse => pulse.events[0])
      .map(pulse => (
        <PulseBlock
          key={pulse.events[0].id}
          events={pulse.events}
          models={pulse.models}
        />
      ))}
    <style jsx>{`
      main {
        display: grid;
        grid-template-columns: minmax(400px, 50%) 2px 1fr;
        font-family: "Roboto Slab";
      }
    `}</style>
  </main>
);

const CurrentBlock = () => (
  <React.Fragment>
    <div className="left" />
    <TimelineSpine bar={false} />
    <div className="right">now</div>
    <style jsx>{`
      div {
        box-sizing: border-box;
        padding: 6px 12px;
      }

      .right {
        flex: 1;
      }
    `}</style>
  </React.Fragment>
);

export default connectSubScriptionTimeline(SubscriptionTimeline);
