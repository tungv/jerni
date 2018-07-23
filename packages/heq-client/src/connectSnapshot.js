import { write } from './logger';

export default async function connectSnapshot({ persistenceConfig, ruleMeta }) {
  const { persist, version } = require(persistenceConfig.driver);
  write('SILLY', {
    type: 'inspect',
    payload: {
      persist: typeof persist,
      version: typeof version,
    },
  });
  // check snapshot version
  const { snapshotVersion } = await version(persistenceConfig, ruleMeta);

  write('SILLY', {
    type: 'inspect',
    payload: {
      snapshotVersion,
    },
  });

  const getPersistenceStream = projection$ => {
    return persist({ _: [persistenceConfig.store] }, projection$, ruleMeta);
  };

  return {
    snapshotVersion,
    getPersistenceStream,
  };
}
