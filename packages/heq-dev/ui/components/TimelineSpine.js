import React from "react";

const TimelineSpine = ({ bar = true }) => (
  <section>
    <div className="vertical">
      <span />
    </div>
    {bar && <div className="horizontal" />}
    <style jsx>{`
      section {
        display: flex;
        flex-direction: column;
      }
      div.vertical {
        height: 100%;
        width: 0;
        border-left: 2px solid #0091ea;
        position: relative;
      }
      div.horizontal {
        position: absolute;
        width: 48px;
        height: 0;
        transform: translateY(-1px);
        border-bottom: 1px solid #0091ea;
        margin: 0;
        padding: 0;
      }

      span {
        display: block;
        position: absolute;
        width: 10px;
        height: 10px;
        background: #0091ea;
        bottom: -5px;
        left: -6px;
        border-radius: 50%;
      }
    `}</style>
  </section>
);
export default TimelineSpine;
