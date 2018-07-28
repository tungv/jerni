import React from 'react';

import tryParse from '../tryParse';

const connect = () => {
  const events$ = new EventSource('/subscribe');

  events$.addEventListener('INCMSG', e => {
    const incoming = tryParse(e.data);
    if (incoming) {
      console.log(incoming);
    }
  });

  return events$;
};

class Subscriber extends React.Component {
  componentDidMount() {
    this.connection = connect();
    console.log('connected');
  }

  componentWillUnmount() {
    if (this.connection) {
      this.connection.close();
      console.log('closed');
    }
  }

  render() {
    return <div>....</div>;
  }
}

export default Subscriber;
