import { applyMiddleware, compose, createStore } from 'redux';
import reduxArrayMiddleware from 'redux-array-middleware';

import rootReducer from './rootReducer';

const compact = array => array.filter(x => x);

const enhancers = compact([
  applyMiddleware(reduxArrayMiddleware),
  typeof window !== 'undefined' &&
    window.__REDUX_DEVTOOLS_EXTENSION__ &&
    window.__REDUX_DEVTOOLS_EXTENSION__(),
]);

const makeStore = (initialState, options) => {
  const store = createStore(rootReducer, initialState, compose(...enhancers));

  if (module.hot) {
    module.hot.accept('./rootReducer', () => {
      const newReducer = require('./rootReducer').default;

      store.replace(newReducer);
    });
  }

  return store;
};

export default makeStore;
