const parseConfig = require('../parseConfig');
const hasModule = require('../has-module');
const mockServer = require('../__mocks__/mockServer');

jest.mock('../has-module');

describe('config', () => {
  let server;

  beforeAll(async () => {
    server = await mockServer(1, [{ id: 1, payload: 'test' }]);
  });

  afterAll(() => {
    server.close();
  });
  describe('config: subscribe', () => {
    it('should throw if subscribe is not defined', () => {
      return expect(parseConfig({})).rejects.toMatchSnapshot();
    });

    it('should throw if subscribe.serverUrl is not defined', () => {
      return expect(parseConfig({ subscribe: {} })).rejects.toMatchSnapshot();
    });

    it('should not throw if subscribe.burstCount or subscribe.burstTime are not defined', async () => {
      const config = await parseConfig(
        {
          subscribe: {
            serverUrl: server.url,
          },
          persist: {
            store: process.env.MONGO_TEST,
          },
          transform: {
            rulePath: '../../fixtures/rules/user_management.js',
          },
        },
        __dirname,
      );

      expect(config).toMatchObject({
        subscribe: {
          serverUrl: server.url,
          burstCount: 20,
          burstTime: 500,
        },
      });
    });

    it('should throw if subscribe.serverUrl is unreachable', () => {
      return expect(
        parseConfig({
          subscribe: {
            serverUrl: 'http://localhost:1338',
          },
        }),
      ).rejects.toMatchSnapshot();
    });
  });

  describe('config: persist', () => {
    it('should detect persist driver is defined', async () => {
      const config = {
        subscribe: { serverUrl: server.url },
        persist: {
          store: process.env.MONGO_TEST,
        },
        transform: {
          rulePath: '../../fixtures/rules/user_management.js',
        },
      };

      expect(await parseConfig(config, __dirname)).toMatchObject({
        persist: {
          store: process.env.MONGO_TEST,
          driver: '@events/snapshot-mongo',
        },
      });

      expect(hasModule).toBeCalledWith('@events/snapshot-mongo');
    });
  });
});
