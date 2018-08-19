import React from 'react';

const TimelineSpine = () => (
  <section>
    <div className="vertical">
      <span />
    </div>
    <div className="horizontal" />
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
        bottom: 0;
        width: 48px;
        height: 0;
        border-top: 1px solid #0091ea;
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
