# heq-migrate

Migration tools for [`heq`](npm.im/heq) server

# Usage

using `npx`

```
$ npx heq-migrate migration.js
```

```js
// migration.js

// map: (event: Event) => Event|false|undefined|true
// return true or a transformed event to commit it, return false or undefined to discard it.
// when no function provided, default to x => x
module.exports = function (event) {
  // there is no id key in event
  // event.id === undefined

  if (event.type === "type_1") return true; // keep this type
  if (event.meta.occurred_at <= 1512345123456) return false; // discard events older than this time

  // modified an event and commit the changes
  if (event.type === "type_2" && event.payload.key !== "value") {
    event.type = "modified_type_2";
    event.payload.key = "new_value";
    return true;
  }

  // return an object to shallowly merge with original event
  if (event.type === "type_3") {
    return {
      type: "modified_type_3",
      payload: { new: "payload" },
      // as no meta is provided, new event copies original meta
    };
  }

  // if you return nothing (undefined) or false, the event will be discarded
};
```
