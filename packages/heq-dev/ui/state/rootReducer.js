import { combineReducers } from 'redux';

import subscriptionState from '../components/subscription.state';

const reducer = combineReducers({
  ...subscriptionState,
});

export default reducer;
