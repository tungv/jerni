# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

<a name="0.3.0"></a>
# [0.3.0](https://github.com/tungv/jerni/compare/jerni-dev@0.2.1...jerni-dev@0.3.0) (2018-08-30)


### Features

* **devtool:** add `--open` options ([a9252ca](https://github.com/tungv/jerni/commit/a9252ca))
* **devtool:** hot code reload ([82c9d61](https://github.com/tungv/jerni/commit/82c9d61))
* **devtool:** move all dev related files to `.jerni-dev` dir ([831b61e](https://github.com/tungv/jerni/commit/831b61e))




<a name="0.2.1"></a>
## [0.2.1](https://github.com/tungv/jerni/compare/jerni-dev@0.2.0...jerni-dev@0.2.1) (2018-08-29)




**Note:** Version bump only for package jerni-dev

<a name="0.2.0"></a>
# [0.2.0](https://github.com/tungv/heq/compare/jerni-dev@0.1.1...jerni-dev@0.2.0) (2018-08-29)


### Bug Fixes

* **devtool:** clean up pulses DB before starting server ([5881797](https://github.com/tungv/heq/commit/5881797))
* **devtool:** kill memleak ([5f72cd1](https://github.com/tungv/heq/commit/5f72cd1))
* **devtool:** needs to use removeEventListener instead of off ([959d6b2](https://github.com/tungv/heq/commit/959d6b2))


### Features

* **devtool:** detect dependencies graph ([7b317fa](https://github.com/tungv/heq/commit/7b317fa))
* **devtool:** implement makeDefer.js ([cdddb3c](https://github.com/tungv/heq/commit/cdddb3c))
* **devtool:** move subscriber process to another process ([2a6a14d](https://github.com/tungv/heq/commit/2a6a14d))
* **devtool:** serialize/deserialize kefir observable ([aa5b943](https://github.com/tungv/heq/commit/aa5b943))
* **devtool:** subprocess sends ok or error before resolving proxy ([e1ab819](https://github.com/tungv/heq/commit/e1ab819))




<a name="0.1.1"></a>
## [0.1.1](https://github.com/tungv/heq/compare/jerni-dev@0.1.0...jerni-dev@0.1.1) (2018-08-26)


### Bug Fixes

* **devtool:** set custom nextjs location ([4ff5742](https://github.com/tungv/heq/commit/4ff5742))




<a name="0.1.0"></a>
# 0.1.0 (2018-08-26)


### Bug Fixes

* **dev:** add missing bin directive ([eb7f351](https://github.com/tungv/heq/commit/eb7f351))
* **dev:** add shebang ([7e58457](https://github.com/tungv/heq/commit/7e58457))
* **devtool:** animation on unmounting JSON editor ([4464d95](https://github.com/tungv/heq/commit/4464d95))
* **devtool:** bug when composing empty event ([e709972](https://github.com/tungv/heq/commit/e709972))
* **devtool:** close confirmation toast after success reload ([90a00d2](https://github.com/tungv/heq/commit/90a00d2))
* **devtool:** fix empty state UI ([d989a7b](https://github.com/tungv/heq/commit/d989a7b))
* **devtool:** INITIALIZED event will always reset ([9e0ad43](https://github.com/tungv/heq/commit/9e0ad43))
* **devtool:** keep some minimum time between 2 pulses when replaying ([76f94af](https://github.com/tungv/heq/commit/76f94af))
* **devtool:** only select event when necessary ([927b0e6](https://github.com/tungv/heq/commit/927b0e6))
* **devtool:** proper stacking for events group ([5594985](https://github.com/tungv/heq/commit/5594985))
* **devtool:** proper subscription and commit ([9c1ced3](https://github.com/tungv/heq/commit/9c1ced3))
* **devtool:** UI opacity ([107500b](https://github.com/tungv/heq/commit/107500b))


### Features

* **dev:** implement dev server ([385ca00](https://github.com/tungv/heq/commit/385ca00))
* **devtool:** add ID to event detail box ([5855946](https://github.com/tungv/heq/commit/5855946))
* **devtool:** add redux ([e19b8c9](https://github.com/tungv/heq/commit/e19b8c9))
* **devtool:** apply button style ([bb74d84](https://github.com/tungv/heq/commit/bb74d84))
* **devtool:** basic styling ([ce4eb98](https://github.com/tungv/heq/commit/ce4eb98))
* **devtool:** basic subscribe/commit flow ([d6dbd98](https://github.com/tungv/heq/commit/d6dbd98))
* **devtool:** commit event ([cec8855](https://github.com/tungv/heq/commit/cec8855))
* **devtool:** committer ([79c802b](https://github.com/tungv/heq/commit/79c802b))
* **devtool:** copy events ([61a088e](https://github.com/tungv/heq/commit/61a088e))
* **devtool:** implement buttons ([2f0c6b8](https://github.com/tungv/heq/commit/2f0c6b8))
* **devtool:** implement subscribe dev command ([281e388](https://github.com/tungv/heq/commit/281e388))
* **devtool:** implement subscription page ([5966195](https://github.com/tungv/heq/commit/5966195))
* **devtool:** implement UI for subscription ([cc8c271](https://github.com/tungv/heq/commit/cc8c271))
* **devtool:** inspect an event ([78b9b11](https://github.com/tungv/heq/commit/78b9b11))
* **devtool:** query a specific event ([87dd57c](https://github.com/tungv/heq/commit/87dd57c))
* **devtool:** reload ([570207d](https://github.com/tungv/heq/commit/570207d))
* **devtool:** styling ([68797f6](https://github.com/tungv/heq/commit/68797f6))
* **devtool:** support lazy loading in a heavy pulse ([6eef733](https://github.com/tungv/heq/commit/6eef733))
* **devtool:** time travel ([5f9c581](https://github.com/tungv/heq/commit/5f9c581))
* **devtool:** time travel ([95c2ff6](https://github.com/tungv/heq/commit/95c2ff6))
* **devtool:** UI for manipulating history ([1c14891](https://github.com/tungv/heq/commit/1c14891))
* **heq-dev:** implement banner ([7953040](https://github.com/tungv/heq/commit/7953040))




<a name="1.2.1"></a>
## [1.2.1](https://github.com/tungv/heq/compare/heq-dev@1.2.0...heq-dev@1.2.1) (2018-08-02)




**Note:** Version bump only for package heq-dev

<a name="1.2.0"></a>
# [1.2.0](https://github.com/tungv/heq/compare/heq-dev@1.1.0...heq-dev@1.2.0) (2018-08-02)


### Bug Fixes

* **devtool:** animation on unmounting JSON editor ([4464d95](https://github.com/tungv/heq/commit/4464d95))
* **devtool:** bug when composing empty event ([e709972](https://github.com/tungv/heq/commit/e709972))
* **devtool:** only select event when necessary ([927b0e6](https://github.com/tungv/heq/commit/927b0e6))


### Features

* **devtool:** add ID to event detail box ([5855946](https://github.com/tungv/heq/commit/5855946))
* **devtool:** apply button style ([bb74d84](https://github.com/tungv/heq/commit/bb74d84))
* **devtool:** commit event ([cec8855](https://github.com/tungv/heq/commit/cec8855))
* **devtool:** committer ([79c802b](https://github.com/tungv/heq/commit/79c802b))
* **devtool:** copy events ([61a088e](https://github.com/tungv/heq/commit/61a088e))
* **devtool:** implement buttons ([2f0c6b8](https://github.com/tungv/heq/commit/2f0c6b8))




<a name="1.1.0"></a>
# [1.1.0](https://github.com/tungv/heq/compare/heq-dev@1.0.2...heq-dev@1.1.0) (2018-07-30)


### Bug Fixes

* **devtool:** fix empty state UI ([d989a7b](https://github.com/tungv/heq/commit/d989a7b))
* **devtool:** proper subscription and commit ([9c1ced3](https://github.com/tungv/heq/commit/9c1ced3))


### Features

* **devtool:** add redux ([e19b8c9](https://github.com/tungv/heq/commit/e19b8c9))
* **devtool:** basic styling ([ce4eb98](https://github.com/tungv/heq/commit/ce4eb98))
* **devtool:** basic subscribe/commit flow ([d6dbd98](https://github.com/tungv/heq/commit/d6dbd98))
* **devtool:** inspect an event ([78b9b11](https://github.com/tungv/heq/commit/78b9b11))
* **devtool:** query a specific event ([87dd57c](https://github.com/tungv/heq/commit/87dd57c))
* **devtool:** styling ([68797f6](https://github.com/tungv/heq/commit/68797f6))




<a name="1.0.2"></a>
## [1.0.2](https://github.com/tungv/heq/compare/heq-dev@1.0.1...heq-dev@1.0.2) (2018-07-24)


### Bug Fixes

* **dev:** add missing bin directive ([eb7f351](https://github.com/tungv/heq/commit/eb7f351))
