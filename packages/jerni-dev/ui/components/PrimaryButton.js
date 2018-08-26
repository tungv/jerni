import { transparentize } from 'polished';
import React from 'react';

const PrimaryButton = ({ children, ...others }) => (
  <button {...others}>
    {children}
    <style jsx>{`
      button {
        -webkit-appearance: none;
        background: #0091ea;
        color: rgba(255, 255, 255, 0.87);
        border: none;
        outline: none;

        margin: 6px 12px;

        font-family: 'Open Sans';

        font-size: 18px;
        padding: 12px 24px;
        text-transform: uppercase;
        box-shadow: 0px 1px 12px 0px rgba(0, 0, 0, 0.29);
        border-radius: 12px;

        transition: background 300ms, box-shadow 100ms ease-in-out;
      }

      button:hover {
        background: ${transparentize(1 / 7, '#0091ea')};
      }

      button:active {
        box-shadow: 0px 0px 2px 0px rgba(0, 0, 0, 0.42);
      }
    `}</style>
  </button>
);

export default PrimaryButton;
