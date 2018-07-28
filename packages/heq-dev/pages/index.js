import React from 'react';
import fetch from 'isomorphic-fetch';
import Head from 'next/head';

import { eventsReceived } from '../ui/components/subscription.state';
import Dispatcher from '../ui/components/Dispatcher';
import Subscriber from '../ui/components/Subscriber';

const Page = ({ children, title = 'heq devtool' }) => (
  <React.Fragment>
    <Head>
      <title>{title}</title>
      <link
        href="https://fonts.googleapis.com/css?family=Open+Sans|Roboto+Slab"
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

const IndexPage = ({ latest }) => (
  <Page title="events timeline | heq devtool">
    <Header>events timeline</Header>

    <pre>{JSON.stringify(latest, null, 2)}</pre>
    <Subscriber latest={latest} />
    <Dispatcher />
  </Page>
);

IndexPage.getInitialProps = async ({ req, store }) => {
  const base = req ? `http://${req.headers.host}` : '';
  const endpoint = `${base}/events/latest`;

  const resp = await fetch(endpoint, {
    headers: { 'content-type': 'application/json' },
  });
  const latest = await resp.json();
  store.dispatch(eventsReceived([latest]));
  return {
    latest,
  };
};

export default IndexPage;
