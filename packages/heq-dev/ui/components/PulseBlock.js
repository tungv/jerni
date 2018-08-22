import { transparentize } from "polished";
import React from "react";
import classnames from "classnames";

import TimelineSpine from "./TimelineSpine";

class PulseBlock extends React.Component {
  state = { collapsed: true };
  expand = () => {
    this.setState({ collapsed: false });
  };
  collapse = () => {
    this.setState({ collapsed: true });
  };
  render() {
    const { events, models } = this.props;
    const { collapsed } = this.state;

    return (
      <section>
        <div className="left">
          {events.length > 1 && (
            <header>
              {events.length} events (#{events[0].id} &mdash; #{
                events[events.length - 1].id
              })
              <span className="spacer" />
              {collapsed && <span onClick={this.expand}>expand</span>}
              {!collapsed && <span onClick={this.collapse}>collapse</span>}
            </header>
          )}
          <EventsGroup
            events={[...events].reverse()}
            collapsed={events.length > 1 && collapsed}
          />
        </div>
        <TimelineSpine />
        <div className="right">
          <ModelsChangeGroup models={models} />
        </div>
        <style jsx>{`
          section {
            width: 100%;
            position: relative;
            font-family: "Roboto Slab";
            display: flex;
            flex-direction: row;
          }

          header {
            display: flex;
            flex-direction: row;
          }

          header .spacer {
            flex: 1;
          }

          div {
            box-sizing: border-box;
            padding: 24px 12px;
          }

          .left {
            width: 480px;
            margin-top: -24px;
          }

          .right {
            flex: 1;
          }
        `}</style>
      </section>
    );
  }
}

const EventsGroup = ({ events, collapsed = false }) => (
  <section className={classnames({ collapsed })}>
    {events.map((event, index) => (
      <div
        key={event.id}
        style={{ "--start": index, "--total": events.length }}
      >
        <EventBox {...event} />
      </div>
    ))}
    <style jsx>{`
      div {
        position: relative;
        transition: 300ms ease-in-out;
        transition-property: margin-top, transform, opacity, box-shadow;
        transition-delay: calc(var(--start) * 450ms / (var(--total))),
          calc(var(--start) * 450ms / (var(--total))),
          calc(var(--start) * 550ms / (var(--total))),
          calc(var(--start) * 550ms / (var(--total)));
        z-index: calc(var(--total) - var(--start));
      }

      .collapsed div {
        box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.29);
        border-radius: 4px;
      }

      .collapsed div {
        opacity: calc(1 - var(--start) * 0.25);
        margin-top: calc(-78px - var(--start) * 1px);
        transform: scale(calc(1 - var(--start) * 0.05));
      }

      .collapsed div:first-child {
        margin-top: 0;
      }
    `}</style>
  </section>
);

const ModelsChangeGroup = ({ models }) =>
  models.map(({ model, added, modified, removed }) => (
    <ChangeBox
      key={`${model.name} (v${model.version}) [${model.source}]`}
      collectionName={`${model.name} (v${model.version}) [${model.source}]`}
      added={added}
      modified={modified}
      removed={removed}
    />
  ));

const ChangeBox = ({ collectionName, added, modified, removed }) => (
  <div>
    {added + modified + removed === 0 && (
      <span className="empty">nothing happened!</span>
    )}
    {added > 0 && (
      <span className="added">
        <output>{added}</output> item{added === 1 ? " has" : "s have"} been
        inserted to <strong>{collectionName}</strong>
      </span>
    )}
    {modified > 0 && (
      <span className="modified">
        <output>{modified}</output> item{modified === 1 ? " has" : "s have"}{" "}
        been modified in <strong>{collectionName}</strong>
      </span>
    )}
    {removed > 0 && (
      <span className="removed">
        <output>{removed}</output> item{removed === 1 ? " has" : "s have"} been
        removed from <strong>{collectionName}</strong>
      </span>
    )}
    <style jsx>{`
      div {
        display: flex;
        flex-direction: column;
      }
      span {
        color: rgba(0, 0, 0, 0.86);
      }
      output {
        font-weight: bold;
        font-family: "Overpass Mono", monospace;
      }
      strong {
        text-decoration: underline;
      }

      .empty {
        color: rgba(0, 0, 0, 0.57);
      }

      .added output {
        color: ${transparentize(1 / 7, "blue")};
      }
      .modified output {
        color: ${transparentize(1 / 7, "purple")};
      }
      .removed output {
        color: ${transparentize(1 / 7, "red")};
      }
    `}</style>
  </div>
);

const EventBox = ({ id, payload, type, meta, selected }) => (
  <div className={classnames("event", { selected })}>
    <header>
      <code>{type}</code>
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
      }

      .selected {
        background: #0091ea;
        color: rgba(255, 255, 255, 0.86);
      }

      .selected .payload {
        color: rgba(255, 255, 255, 0.57);
      }

      header {
        display: flex;
        flex-direction: row;
        align-items: center;
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

export default PulseBlock;
