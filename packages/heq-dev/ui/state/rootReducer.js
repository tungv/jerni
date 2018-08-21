import { combineReducers } from 'redux';

import dispatcherState from '../components/dispatcher.state';
import pulsesState from '../components/pulsesState';
import subscriptionState from '../components/subscription.state';
import timelineState from '../components/timeline.state';

const reducer = combineReducers({
  ...subscriptionState,
  ...timelineState,
  ...dispatcherState,
  ...pulsesState,
});

export default reducer;
