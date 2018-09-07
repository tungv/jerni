# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

<a name="0.3.2"></a>
## [0.3.2](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.3.1...@jerni/store-mongo@0.3.2) (2018-09-07)


### Bug Fixes

* **store-mongo:** should not set option.strict = true ([14109c3](https://github.com/tungv/jerni/commit/14109c3))




<a name="0.3.1"></a>
## [0.3.1](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.3.0...@jerni/store-mongo@0.3.1) (2018-09-06)




**Note:** Version bump only for package @jerni/store-mongo

<a name="0.3.0"></a>
# [0.3.0](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.2.7...@jerni/store-mongo@0.3.0) (2018-09-05)


### Features

* **store-mongo:** make store more reliable by allow infinite retries ([52c7925](https://github.com/tungv/jerni/commit/52c7925))
* **store-mongo:** only subscribe when waitFor is called ([8c48561](https://github.com/tungv/jerni/commit/8c48561))




<a name="0.2.7"></a>
## [0.2.7](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.2.6...@jerni/store-mongo@0.2.7) (2018-09-03)




**Note:** Version bump only for package @jerni/store-mongo

<a name="0.2.6"></a>
## [0.2.6](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.2.5...@jerni/store-mongo@0.2.6) (2018-09-03)




**Note:** Version bump only for package @jerni/store-mongo

<a name="0.2.5"></a>
## [0.2.5](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.2.4...@jerni/store-mongo@0.2.5) (2018-09-03)




**Note:** Version bump only for package @jerni/store-mongo

<a name="0.2.4"></a>
## [0.2.4](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.2.3...@jerni/store-mongo@0.2.4) (2018-09-03)




**Note:** Version bump only for package @jerni/store-mongo

<a name="0.2.3"></a>
## [0.2.3](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.2.2...@jerni/store-mongo@0.2.3) (2018-09-01)




**Note:** Version bump only for package @jerni/store-mongo

<a name="0.2.2"></a>
## [0.2.2](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.2.1...@jerni/store-mongo@0.2.2) (2018-08-30)




**Note:** Version bump only for package @jerni/store-mongo

<a name="0.2.1"></a>
## [0.2.1](https://github.com/tungv/jerni/compare/@jerni/store-mongo@0.2.0...@jerni/store-mongo@0.2.1) (2018-08-29)




**Note:** Version bump only for package @jerni/store-mongo

<a name="0.2.0"></a>
# 0.2.0 (2018-08-29)


### Bug Fixes

* **mongo:** exports Model and Connection ([199abd2](https://github.com/tungv/jerni/commit/199abd2))
* **mongo:** implement latestEventId getter ([65500f4](https://github.com/tungv/jerni/commit/65500f4))
* **mongo:** initialize latestEventId after a successful connection ([c489aee](https://github.com/tungv/jerni/commit/c489aee))
* **mongo:** make sure only one `bulkWrite` for each collection happen at a same time ([e67118a](https://github.com/tungv/jerni/commit/e67118a))
* **mongo:** optimistic insert for batch ([2592bd0](https://github.com/tungv/jerni/commit/2592bd0))
* **mongo:** resolve `connected` defer after setting up watch ([0c0a523](https://github.com/tungv/jerni/commit/0c0a523))
* **mongo:** safely run transform and ignore exceptions ([43cc835](https://github.com/tungv/jerni/commit/43cc835))


### Features

* **mongo:** add deleteOne and deleteMany ([0841865](https://github.com/tungv/jerni/commit/0841865))
* **mongo:** add mongo heartbeat ([dad1ab2](https://github.com/tungv/jerni/commit/dad1ab2))
* **mongo:** apply realtime watching using oplogs ([d298223](https://github.com/tungv/jerni/commit/d298223))
* **mongo:** buffer multiple ops before writing ([fcdff8a](https://github.com/tungv/jerni/commit/fcdff8a))
* **mongo:** implement insertOne ([82ee6fc](https://github.com/tungv/jerni/commit/82ee6fc))
* **mongo:** implement oplog watching ([3911dbd](https://github.com/tungv/jerni/commit/3911dbd))
* **mongo:** initialize store mongo ([8789701](https://github.com/tungv/jerni/commit/8789701))
* **mongo:** transform updateMany ([329490d](https://github.com/tungv/jerni/commit/329490d))
* **mongo:** update/insert one/many ([8d5d40e](https://github.com/tungv/jerni/commit/8d5d40e))




<a name="0.1.4"></a>
## [0.1.4](https://github.com/tungv/heq/compare/@heq/store-mongo@0.1.3...@heq/store-mongo@0.1.4) (2018-08-29)




**Note:** Version bump only for package @heq/store-mongo

<a name="0.1.3"></a>
## [0.1.3](https://github.com/tungv/heq/compare/@heq/store-mongo@0.1.2...@heq/store-mongo@0.1.3) (2018-08-26)




**Note:** Version bump only for package @heq/store-mongo

<a name="0.1.2"></a>
## [0.1.2](https://github.com/tungv/heq/compare/@heq/store-mongo@0.1.1...@heq/store-mongo@0.1.2) (2018-08-26)


### Bug Fixes

* **mongo:** exports Model and Connection ([199abd2](https://github.com/tungv/heq/commit/199abd2))
* **mongo:** initialize latestEventId after a successful connection ([c489aee](https://github.com/tungv/heq/commit/c489aee))
* **mongo:** optimistic insert for batch ([2592bd0](https://github.com/tungv/heq/commit/2592bd0))
* **mongo:** resolve `connected` defer after setting up watch ([0c0a523](https://github.com/tungv/heq/commit/0c0a523))
* **mongo:** safely run transform and ignore exceptions ([43cc835](https://github.com/tungv/heq/commit/43cc835))
