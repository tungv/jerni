import React from 'react';

export default function delayUnmounting(Component) {
  return class extends React.Component {
    state = {
      shouldRender: this.props.isMounted,
    };

    componentDidUpdate(lastProps) {
      const props = this.props;

      if (lastProps.isMounted && !props.isMounted) {
        setTimeout(
          () => this.setState({ shouldRender: false }),
          lastProps.delayTime
        );
      } else if (!lastProps.isMounted && props.isMounted) {
        this.setState({ shouldRender: true });
      }
    }

    render() {
      return this.state.shouldRender ? <Component {...this.props} /> : null;
    }
  };
}
