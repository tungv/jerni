import filtr from 'filtr';

import { shouldLog, write } from './logger';

export default array => {
  const safely = fn => async () => {
    try {
      await fn();
      return true;
    } catch (e) {
      const data = {
        type: 'err-side-effect-failed',
        payload: { error: { message: e.message } },
      };

      if (shouldLog('DEBUG')) {
        data.payload.error.stack = e.stack;
      }

      write('WARN', data);
      return false;
    }
  };

  const isMatch = (cond, obj) => {
    if (typeof cond === 'function') {
      return safelyTrue(() => cond(obj));
    }

    const query = filtr(cond);
    return query.test([obj]).length > 0;
  };

  const safelyTrue = fn => {
    try {
      return fn() === true;
    } catch (ex) {
      return false;
    }
  };

  return async requests => {
    const start = Date.now();

    const promises = [];

    requests.forEach(ctx => {
      array.forEach(sideEffect => {
        const { when, execute } = sideEffect;

        if (!when || !execute) {
          return false;
        }

        const successfullyExecute = safely(() =>
          execute(ctx.event, ctx.projections, ctx.changes)
        );

        const satisfied = isMatch(when, ctx.event);

        if (satisfied) {
          return promises.push(successfullyExecute());
        }

        return false;
      });
    });

    const allDone = await Promise.all(promises);
    return {
      successfulEffects: allDone.filter(success => success).length,
      duration: Date.now() - start,
    };
  };
};
