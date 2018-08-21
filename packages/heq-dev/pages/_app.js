import { Provider } from 'react-redux';
import App, { Container } from 'next/app';
import Head from 'next/head';
import React from 'react';
import withRedux from 'next-redux-wrapper';

import makeStore from '../ui/state/makeStore';

class ReduxApp extends App {
  static async getInitialProps({ Component, ctx }) {
    const pageProps = Component.getInitialProps
      ? await Component.getInitialProps(ctx)
      : {};
    return { pageProps };
  }

  render() {
    const { Component, pageProps, store } = this.props;

    return (
      <Container>
        <Head>
          <script src="/socket.io/socket.io.js" />
        </Head>
        <Provider store={store}>
          <Component {...pageProps} />
        </Provider>
      </Container>
    );
  }
}

export default withRedux(makeStore)(ReduxApp);
