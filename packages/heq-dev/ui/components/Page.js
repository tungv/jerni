import React from 'react';
import Head from 'next/head';

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

export default Page;
