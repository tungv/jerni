import Head from 'next/head';
import React from 'react';
import fetch from 'isomorphic-fetch';

import { eventSelected } from '../ui/components/timeline.state';
import { eventsReceived } from '../ui/components/subscription.state';
import Dispatcher from '../ui/components/Dispatcher';
import EventDetailBox from '../ui/components/EventDetailBox';
import EventsTimeline from '../ui/components/EventsTimeline';
import Subscriber from '../ui/components/Subscriber';

const getJSON = async (endpoint, opts = {}) => {
  const { headers = {} } = opts;
  const enhancedHeaders = {
    ...headers,
    'content-type': 'application/json',
  };
  const resp = await fetch(endpoint, { ...opts, headers: enhancedHeaders });

  const json = await resp.json();

  return json;
};

const Page = ({ children, title = 'heq devtool' }) => (
  <React.Fragment>
    <Head>
      <title>{title}</title>
      <link
        href="https://fonts.googleapis.com/css?family=Open+Sans|Roboto+Slab|Overpass+Mono"
        rel="stylesheet"
      />
    </Head>
    <main>{children}</main>
    <style jsx>{`
      main {
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
    `}</style>
  </React.Fragment>
);

const Header = ({ children }) => (
  <header>
    <h1>{children}</h1>
    <style jsx>{`
      header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;

        height: 72px;
        font-family: 'Open Sans';
      }
    `}</style>
  </header>
);

const IndexPage = ({ latest, selected, store }) => (
  <Page title="events timeline | heq devtool">
    <Subscriber lastSeen={latest ? latest.id : 0} />
    <Header>heq devtool</Header>
    <div>
      <section>
        <EventsTimeline />
      </section>
      <section>{latest && <EventDetailBox event={selected} />}</section>
    </div>

    <Dispatcher />

    <style jsx>{`
      div {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-column-gap: 16px;
        width: 1600px;
        max-width: 100%;
        min-width: 800px;
        margin: auto;
      }
      section {
        display: flex;
        flex-direction: column;

        flex: 1;
      }
    `}</style>
  </Page>
);

const getLatestEvents = async (base, max) => {
  const endpoint = `${base}/events/latest`;
  const latest = await getJSON(endpoint);
  const { id } = latest;

  const lastN = await getJSON(
    `${base}/query?lastEventId=${Math.max(0, id - max)}`
  );

  return lastN;
};

const getEventById = async (base, id) => {
  const endpoint = `${base}/dev/events/${id}`;
  try {
    const event = await getJSON(endpoint);
    return event;
  } catch (ex) {
    return null;
  }
};

IndexPage.getInitialProps = async ({ req, query: { eventId }, store }) => {
  const base = req ? `http://${req.headers.host}` : '';
  let latest = null;
  const loadedEvents = store.getState().events;

  if (loadedEvents.length === 0) {
    const last10 = await getLatestEvents(base, 10);
    latest = last10[last10.length - 1];
    store.dispatch(eventsReceived(last10));
  } else {
    latest = loadedEvents[loadedEvents.length - 1];
  }

  const selected = eventId ? await getEventById(base, eventId) : latest;

  if (selected) {
    store.dispatch(eventSelected(selected.id));
  }

  return {
    latest,
    selected,
  };
};

export default IndexPage;
