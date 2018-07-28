import React from 'react';

import tryParse from '../tryParse';

const dispatch = async (type, payload) => {
  const resp = await fetch('/commit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      type,
      payload,
      meta: {
        occurredAt: Date.now(),
        client: 'heq-dev',
        clientVersion: 'alpha',
      },
    }),
  });

  const json = await resp.json();

  return json.id;
};

class Dispatcher extends React.Component {
  state = { eventType: 'TEST', payloadAsString: '{\n}', submitting: false };

  submit = async () => {
    const { eventType, payloadAsString } = this.state;
    const payloadAsObject = tryParse(payloadAsString);

    if (payloadAsObject) {
      this.setState({ submitting: true });
      await dispatch(eventType, payloadAsObject);
      this.setState({ submitting: false });
    }
  };

  handleTextAreaChange = e => {
    const value = e.currentTarget.value;
    this.setState({ payloadAsString: value });
  };

  render() {
    return (
      <div>
        <textarea
          name="event-body"
          id="event-body"
          cols="30"
          rows="10"
          value={this.state.payloadAsString}
          onChange={this.handleTextAreaChange}
        />
        <button onClick={this.submit} disabled={this.state.submitting}>
          {this.state.submitting ? 'sending...' : 'dispatch'}
        </button>
      </div>
    );
  }
}

export default Dispatcher;
