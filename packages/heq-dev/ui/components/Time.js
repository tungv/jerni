import React from 'react';

export default class Time extends React.Component {
  willRefresh() {
    this.timer = setTimeout(() => {
      this.forceUpdate();
      this.willRefresh();
    }, this.props.refresh);
  }
  componentDidMount() {
    this.willRefresh();
  }

  componentWillUnmount() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  render() {
    const { children, ...others } = this.props;
    return children(others);
  }
}
