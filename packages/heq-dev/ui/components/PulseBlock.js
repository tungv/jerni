import React from 'react';
import classnames from 'classnames';

import TimelineSpine from './TimelineSpine';

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
            font-family: 'Roboto Slab';
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
  <div className={classnames('events-group', { collapsed })}>
    {events.map(event => (
      <div key={event.id}>
        <EventBox {...event} />
      </div>
    ))}
    <style jsx>{`
      div {
        position: relative;
        transition: all 300ms ease-out;
      }

      .collapsed div {
        box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.29);
        border-radius: 4px;
      }

      .events-group > div:nth-child(2) {
        transition-delay: 100ms;
        z-index: 3;
      }
      .events-group > div:nth-child(3) {
        z-index: 2;
        transition-delay: 200ms;
      }
      .events-group > div:nth-child(n + 4) {
        z-index: 1;
        transition-delay: 300ms;
      }

      div > div:nth-child(1) {
        z-index: 4;
      }
      div.collapsed > div:nth-child(2) {
        opacity: 0.75;
        transform: scale(0.95);
        margin-top: -78px;
      }
      div.collapsed > div:nth-child(3) {
        opacity: 0.5625;
        transform: scale(0.9025);
        margin-top: -78px;
      }
      div.collapsed > div:nth-child(n + 4) {
        opacity: 0.4;
        transform: scale(0.857375);
        margin-top: -90px;
      }
    `}</style>
  </div>
);

const ModelsChangeGroup = ({ models }) =>
  models.map(({ model, added, modified, removed }) => (
    <ChangeBox
      key={`${model.name} (v${model.version})`}
      collectionName={`${model.name} (v${model.version})`}
      added={added}
      modified={modified}
      removed={removed}
    />
  ));

const ChangeBox = ({ collectionName, added, modified, removed }) => (
  <div>
    {added + modified + removed === 0 && <span>nothing happened!</span>}
    {added > 0 && (
      <span>
        <output>{added}</output> item{added === 1 ? ' has' : 's have'} been
        inserted to <strong>{collectionName}</strong>
      </span>
    )}
    {modified > 0 && (
      <span>
        <output>{modified}</output> item{modified === 1 ? ' has' : 's have'}{' '}
        been modified in <strong>{collectionName}</strong>
      </span>
    )}
    {removed > 0 && (
      <span>
        <output>{removed}</output> item{removed === 1 ? ' has' : 's have'} been
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
        font-family: 'Overpass Mono', monospace;
      }
      strong {
        text-decoration: underline;
      }
    `}</style>
  </div>
);

const EventBox = ({ id, payload, type, meta, selected }) => (
  <div className={classnames('event', { selected })}>
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
        font-family: 'Overpass Mono', monospace;
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
