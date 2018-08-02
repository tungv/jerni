import { combineReducers } from 'redux';

import subscriptionState from '../components/subscription.state';
import timelineState from '../components/timeline.state';
import dispatcherState from '../components/dispatcher.state';

const reducer = combineReducers({
  ...subscriptionState,
  ...timelineState,
  ...dispatcherState,
});

export default reducer;
