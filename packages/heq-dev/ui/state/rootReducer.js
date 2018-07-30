import { combineReducers } from 'redux';

import subscriptionState from '../components/subscription.state';
import timelineState from '../components/timeline.state';

const reducer = combineReducers({
  ...subscriptionState,
  ...timelineState,
});

export default reducer;
