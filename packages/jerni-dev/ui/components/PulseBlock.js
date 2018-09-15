import { connect } from "react-redux";
import { transparentize } from "polished";
import React from "react";
import classnames from "classnames";

import { removingEventCount } from "./eventsState";
import TimelineEventBox from "./TimelineEventBox";
import TimelineSpine from "./TimelineSpine";

const connectBlockToRedux = connect((state, props) => ({
  removingCount: removingEventCount(state, props.events.map(event => event.id))
}));

class PulseBlock extends React.Component {
  state = { collapsed: true, max: 20 };
  expand = () => {
    this.setState({ collapsed: false });
  };
  collapse = () => {
    this.setState({ collapsed: true, max: 20 });
  };

  loadMore = () => {
    this.setState(state => ({ max: state.max + 20 }));
  };

  render() {
    const { events, models, removingCount } = this.props;
    const { collapsed, max } = this.state;

    const totalChanges = models.reduce(
      (count, { added, modified, removed }) =>
        count + added + modified + removed,
      0
    );

    return (
      <React.Fragment>
        <div className="left">
          {events.length > 1 && (
            <header>
              <span>
                {events.length} events (#{events[0].id} &mdash; #{
                  events[events.length - 1].id
                })
              </span>
              {removingCount > 0 && (
                <span className="removing">{removingCount} marked</span>
              )}
              <span className="spacer" />
              {collapsed && <span onClick={this.expand}>expand</span>}
              {!collapsed && <span onClick={this.collapse}>collapse</span>}
            </header>
          )}
          <EventsGroup
            events={[...events].reverse()}
            collapsed={events.length > 1 && collapsed}
            max={max}
            loadMore={this.loadMore}
            collapse={this.collapse}
          />
        </div>
        <TimelineSpine />
        <div className="right">
          {totalChanges === 0 && (
            <span className="empty">nothing happened!</span>
          )}
          {totalChanges > 0 && <ModelsChangeGroup models={models} />}
        </div>
        <style jsx>{`
          header {
            display: flex;
            flex-direction: row;
          }

          header span.removing {
            padding-left: 6px;
            color: rgba(0, 0, 0, 0.56);
          }

          header .spacer {
            flex: 1;
          }

          div {
            box-sizing: border-box;
            padding: 24px 12px;
          }

          .left {
            /* max-width: 50%; */
            margin-top: -24px;
          }

          .right {
            flex: 1;
          }

          .empty {
            color: rgba(0, 0, 0, 0.57);
          }
        `}</style>
      </React.Fragment>
    );
  }
}

const EventsGroup = ({ events, collapsed, max, loadMore, collapse }) => (
  <section id={events[0].id} className={classnames({ collapsed })}>
    {events.slice(0, max).map((event, index) => (
      <div
        key={index}
        style={{
          "--start": index,
          "--total": Math.min(events.length, 20)
        }}
      >
        <TimelineEventBox {...event} />
      </div>
    ))}
    {!collapsed && (
      <p>
        {events.length > max && <a onClick={loadMore}>more</a>}{" "}
        {events.length > 20 && (
          <a onClick={collapse} href={`#${events[0].id}`}>
            collapse
          </a>
        )}
      </p>
    )}
    <style jsx>{`
      section {
        padding: 12px 0;
        min-height: 84px;
      }
      div {
        position: relative;
        transition: 300ms ease-in-out;
        transition-property: margin-top, transform, opacity, box-shadow;
        transition-delay: calc(var(--start) * 450ms / (var(--total))),
          calc(var(--start) * 450ms / (var(--total))),
          calc(var(--start) * 350ms / (var(--total))),
          calc(var(--start) * 350ms / (var(--total)));
        z-index: calc(var(--total) - var(--start));
      }
      p a {
        text-decoration: none;
        cursor: pointer;
        user-select: none;
        color: rgba(0, 0, 0, 0.87);
        margin-left: 12px;
      }

      p {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
      }

      .collapsed div {
        box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.29);
        border-radius: 4px;
      }

      .collapsed div:nth-child(-n + 19) {
        opacity: calc(1 - var(--start) * 0.25);
        margin-top: calc(-78px - var(--start) * 1px);
        transform: scale(calc(1 - var(--start) * 0.05));
      }

      .collapsed div:nth-child(n + 20) {
        opacity: 1;
        margin-top: calc(-80px - (var(--start) - 19) * 0.5px);
        transform: scale(0.01);
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

export default connectBlockToRedux(PulseBlock);
