import { transparentize } from "polished";
import React from "react";

const SecondaryButton = ({ children, ...others }) => (
  <button {...others}>
    {children}
    <style jsx>{`
      button {
        -webkit-appearance: none;
        box-sizing: border-box;
        border: 2px solid #dcedc8;
        border-radius: 12px;
        color: rgba(0, 0, 0, 0.87);
        background: ${transparentize(2 / 7, "#dcedc8")};
        outline: none;

        font-family: "Open Sans";

        font-size: 18px;
        padding: 10px 22px;
        text-transform: uppercase;

        transition: background 300ms ease-in-out;
      }

      button:hover {
        background: ${transparentize(3 / 7, "#dcedc8")};
        transition: background 100ms ease-in-out;
      }

      button:active {
        background: ${transparentize(1 / 7, "#dcedc8")};
      }
    `}</style>
  </button>
);

export default SecondaryButton;
