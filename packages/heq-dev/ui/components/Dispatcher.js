import JSONInput from 'react-json-editor-ajrm';
import React from 'react';
import classnames from 'classnames';
import locale from 'react-json-editor-ajrm/dist/locale/en';

import delayUnmounting from './delayUnmounting';

const EMPTY = { type: 'TEST', payload: {} };

const JSONInputAnimated = delayUnmounting(JSONInput);

const dispatch = async body => {
  const resp = await fetch('/commit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json();

  return json.id;
};

class Dispatcher extends React.Component {
  state = { eventType: 'TEST', open: false, payload: EMPTY, submitting: false };

  submit = async () => {
    const { payload } = this.state;

    if (payload) {
      const body = {
        type: payload.type,
        payload: payload.payload,
        meta: {
          occurredAt: Date.now(),
          client: 'heq-dev',
          clientVersion: 'alpha',
          ...(payload.meta || {}),
        },
      };

      this.setState({ submitting: true });
      await dispatch(body);
      this.setState({ submitting: false });
    }
  };

  handleTextAreaChange = e => {
    const value = e.currentTarget.value;
    this.setState({ payloadAsString: value });
  };

  render() {
    const {
      state: { open },
    } = this;

    return (
      <div className={classnames({ open }, 'root')}>
        <header>
          <div className="closed-header">
            <span onClick={() => this.setState({ open: true })}>Compose</span>
          </div>
          <div className="open-header">
            <span
              className={classnames({
                disabled: !this.state.payload || this.state.submitting,
              })}
              onClick={() => {
                this.submit();
                // this.setState({ open: false });
              }}
            >
              Commit
            </span>
            {/* <span onClick={() => this.setState({ open: false })}>Reset</span> */}
            <span onClick={() => this.setState({ open: false })}>Close</span>
          </div>
        </header>

        <div className="detail">
          <JSONInputAnimated
            isMounted={open}
            delayTime={300}
            id="event-body"
            placeholder={EMPTY}
            onChange={({ jsObject }) => {
              this.setState({ payload: jsObject });
            }}
            locale={locale}
            width="100%"
            style={{
              body: {
                fontSize: '16px',
                fontFamily: "'Overpass Mono', monospace",
              },
            }}
          />
        </div>

        <style jsx>{`
          .root {
            position: fixed;
            bottom: 0;
            right: 120px;
            height: 36px;
            width: 120px;
            background: #0091ea;
            transition: all 300ms ease-in-out;
            overflow: hidden;
          }

          header {
            color: white;
            font-family: 'Open Sans';
            display: flex;
            flex-direction: row;
            width: 240px;
          }

          header > div {
            height: 36px;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            transition: all 300ms 250ms ease-in-out;
            text-transform: uppercase;
          }

          header > div > span:hover {
            background: rgba(255, 255, 255, 0.14);
          }
          header > div > span.disabled {
            background: rgba(255, 255, 255, 0.87);
            color: rgba(0, 0, 0, 0.57);
            pointer-events: none;
          }

          header > div > span {
            cursor: pointer;
            width: 120px;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .open-header {
            transform: translateX(120px);
            opacity: 0.5;
          }

          .root.open {
            width: calc(50% - 120px);
            height: 550px;
            bottom: 36px;
            box-shadow: 0 5px 48px 5px rgba(0, 0, 0, 0.29);
          }

          .open .closed-header {
            transform: translateX(-120px);
            opacity: 0.5;
          }
          .open .open-header {
            transform: translateX(-120px);
            opacity: 1;
          }
        `}</style>
      </div>
    );

    return (
      <div>
        <button disabled={!this.state.payload || this.state.submitting}>
          {this.state.submitting ? 'sending...' : 'dispatch'}
        </button>
        <style jsx>{`
          display: flex;
          flex-direction: row;
        `}</style>
      </div>
    );
  }
}

export default Dispatcher;
