import { connect } from "react-redux";
import { transparentize } from "polished";
import React from "react";

import { socketEmit } from "../state/socket-io-middleware";
import PrimaryButton from "./PrimaryButton";

const connectToolbarToRedux = connect(
  state => ({
    isReloading: state.isReloading
  }),
  {
    onRefreshButtonClick: () =>
      socketEmit({
        type: "RELOAD"
      })
  }
);

const Toolbar = ({ onRefreshButtonClick, isReloading }) => (
  <nav>
    <header>
      <h4>[jerni devtool]</h4>
    </header>
    <span />
    <section>
      <PrimaryButton disabled={isReloading} onClick={onRefreshButtonClick}>
        {isReloading ? "Reloading" : "Reload"}
      </PrimaryButton>
    </section>
    <style jsx>{`
      nav {
        background: ${transparentize(3 / 7, "#0091ea")};
        display: flex;
        flex-direction: row;
      }

      header {
        padding: 0 24px;
        display: flex;
        align-items: center;
      }

      h4 {
        margin: 0;
        color: rgba(0, 0, 0, 0.86);
        font-family: "Overpass Mono";
        font-size: 24px;
      }
      span {
        flex: 1;
      }
    `}</style>
  </nav>
);

export default connectToolbarToRedux(Toolbar);
