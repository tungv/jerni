import React from 'react';

import Page from '../ui/components/Page';
import SubscriptionTimeline from '../ui/components/SubscriptionTimeline';
import sampleStream from '../ui/sample-stream';

const SubscriptionPage = ({ latest, selected, store }) => (
  <Page title="events timeline | heq devtool">
    <SubscriptionTimeline stream={sampleStream} />
  </Page>
);

export default SubscriptionPage;
