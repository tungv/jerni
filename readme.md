![logo](./logo.png)

# jerni - accessible event-sourcing for everyone

`jerni` provides a foundation to build a lowly coupled, highly cohesive umbrella of software systems that process a same high-dimensional data space.

# Design goals

`jerni` is designed to help teams build software systems that are:

1. **Resilient to changes** by minimizing the cost to revert a decision, either it's technological or business related
2. **Autonomous** by minimizing the runtime dependencies across units and organizational dependencies across teams.

These goals are tend to focus on projects in their forming and storming stage where changes are inevitable. When a project grows pass these stages and becomes more stable in terms of requirements, migrating away from `jerni` to a more performance-centric approach might be a good option and the path will be clearer at that point.

## Goal #1: Resilience to changes

High cohesiveness encapsulates implementation details within well-defined boundaries, prevents breaking changes from leaking out to other sibling systems. Systems that are resilient to changes are faster to design because decisions take less time to make. These systems are also disposable. Teams can abandon a failing experiment with fewer footprints, encouraging them to iterate more freely. Detaching a system does not require other systems to change because they didn't know anything at the first place.

## Goal #2: Autonomy

Building self-contained systems boosts development velocity because they are free from runtime and organizational dependencies. They can run standalone and even when all other systems are not available (no runtime dependencies). Developing and testing such systems is much easier than working with a network of microservices or a single giant monolith (no organizational dependencies).

New engineers can get onboard more quickly because they don't need to learn about the whole umbrella of systems in order to make their first contributions. Ownership is also clearer due to separation of concerns, and in this context, concerns are business domains.

# How does it work?

`jerni` is built based on event-sourcing and CQRS architectures, where changes are recorded as events in an append-only data storage.

```
  +-------------+             +------------------+
  |             |   request   |                  |   commit
  | User-facing +------------>+ Business domain  +-----------------+
  | Interface   |  response   | Service API      |                 |
  |             |             |                  |                 |
  +-------------+             +--------+---------+                 |
                                       |                           |
                                       | read                      v
                                       v                   +-------+------+
                                  +----+-----+             |              |
                                  |          |             | append-only  |
                                  |  Domain  |             | events       |
                                  |  Data-   |             | queue        |
                                  |  base    |             |              |
                                  |          |             | (heq-server) |
                                  +----+-----+             |              |
                                       ^                   |              |
                                       |                   +-------+------+
                                       | write                     |
                                       |                           |
                              +--------+----------+                |
                              |                   |                |
                              | Business domain   |   push         |
                              | Subscription Job  +<---------------+
                              |                   |
                              | (jerni)           |
                              |                   |
                              +-------------------+
```

Each business domain will include:

1. a user-facing interface, mostly a webapp or a mobile app, sometimes it can be a CLI. This is important to understand that had it not been for that user-facing interface, there would not have been a separate system.
2. a backend API that reads data from its own database in response to requests from the aforementioned user-facing interface. This backend will not directly write data back to its database. To reflect change, it will `commit()` a new event to events queue. Events must be self-contained and represent a human user's behaviors in business terms.
3. a background job that receives new events from queue and transform them to database operations and execute them in an idempotent manner. Note that events are not only from its own backend API services, but also from other sibling systems.

The combination of UI, API and Job makes up a self-contained system that has no runtime dependency to anything but the events queue.

# Trade-offs

In order to achieve the goals, there are a few unconventional constraints `jerni` requires your system to comply.

1. Changes (mutations) in your system have to be described as JSON objects. With the following schema `{"type": String, "payload": any, "meta": Object}`
2. Events are described in business terms (eg. `"USER_REGISTERED"`, `"TRANSACTION_MADE"`, `"ACCOUNT_SUSPENDED"`), in contrast to technical terms (`"INSERTED"`, `"UPDATED"`, `"DELETED"`). The dictionary of your events is the only contract your team needs to agree on.
3. Strong consistency is harder to achieve than how it is in a monolith and a single database. However, it's not any more difficult in comparison to a system with multiple databases. In many cases, it turns out to be easier. Having that said, a `jerni` system is not inconsistent, it's eventually consistent.
4. The event queue is your backbone and it needs to be reliable and highly available. However, when it's not available, your system is not down, but effectively read-only.
5. You cannot delete or modify committed events. Therefore data that must be able to remove (eg. due to legal obligation, etc.) shall not be stored in events. In other words, if you plan to comply the GDPR, keep personal data away from events queue and only store a linkable ID in event.

If some of these constraints are show-stopper to your products, unfortunately `jerni` is not applicable.

# Contribution

This repository hosts a number of packages including (but not limit to):

1. [heq-server](https://npm.im/heq-server): a node library to create HTTP-powered append-only events queue.
2. [@heq/server-redis](https://npm.im/@heq/server-redis): an implementation of `heq-server`-compatible queue using `redis` as the storage engine.
3. [heq](https://npm.im/heq): a command-line tool to start an http server running a `@heq/server-redis` queue.
4. [jerni](https://npm.im/jerni): a command-line tool and node library to construct and run the subscription job.
5. [jerni-dev](https://npm.im/jerni-dev): a command-line tool and test helpers to ease the development involving `jerni`.
6. [@jerni/store-mongo](https://npm.im/@jerni/store-mongo): an implementation of database persistence layer for `mongodb`, it manages database connection and guarantees idempotency of the transformation.
