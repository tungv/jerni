import { combineReducers } from "redux";

import eventsState from "../components/eventsState";
import pulsesState from "../components/pulsesState";

const reducer = combineReducers({
  ...pulsesState,
  ...eventsState
});

export default reducer;
