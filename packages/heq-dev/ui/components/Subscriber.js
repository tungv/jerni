import { connect } from 'react-redux';
import { format } from 'date-fns';
import React from 'react';

import { eventsReceived } from './subscription.state';
import tryParse from '../tryParse';

const subscribe = ({ from = 0 }, onIncomingEvents) => {
  const events$ = new EventSource(`/subscribe?lastEventId=${from}`);

  events$.addEventListener('INCMSG', e => {
    const incoming = tryParse(e.data);
    if (incoming && incoming.length) {
      onIncomingEvents(incoming);
    }
  });

  return events$;
};

const connectToRedux = connect(
  state => ({ lastReceivedAt: state.lastReceivedAt }),
  {
    onIncomingEvents: eventsReceived,
  }
);

class Subscriber extends React.Component {
  state = {
    lastSeen: this.props.lastSeen,
  };

  componentDidMount() {
    this.connection = subscribe({ from: this.state.lastSeen }, eventsArray => {
      this.props.onIncomingEvents(eventsArray);
      this.setState({ lastSeen: eventsArray[eventsArray.length - 1].id });
    });
    console.log(`connected from ${this.state.lastSeen}`);
  }

  componentWillUnmount() {
    if (this.connection) {
      this.connection.close();
      console.log('closed');
    }
  }

  render() {
    const {
      props: { lastReceivedAt },
    } = this;
    return (
      <div>
        connected last received at{' '}
        {format(lastReceivedAt, 'YYYY-MMM-DD hh:mm:ss')}
      </div>
    );
  }
}

export default connectToRedux(Subscriber);
