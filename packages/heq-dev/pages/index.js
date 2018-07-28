import React from 'react';
import fetch from 'isomorphic-fetch';

import Subscriber from '../ui/components/Subscriber';
import Dispatcher from '../ui/components/Dispatcher';

const IndexPage = ({ latest }) => (
  <h1>
    welcome to heq devtool
    <pre>{JSON.stringify(latest, null, 2)}</pre>
    <Subscriber />
    <Dispatcher />
  </h1>
);

IndexPage.getInitialProps = async ({ req, ...ctx }) => {
  const base = req ? `http://${req.headers.host}` : '';
  const endpoint = `${base}/events/latest`;

  const resp = await fetch(endpoint, {
    headers: { 'content-type': 'application/json' },
  });
  const latest = await resp.json();

  return {
    latest,
  };
};

export default IndexPage;
