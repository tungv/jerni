# jerni-dev

## Installation

```
y add jerni
y add -D jerni-dev
```

## Usage

To start developing a `jerni` project, you can use `jerni-dev` to setup hot-reload, event editor and other useful devtools.
First, replace `jerni` command with `jerni-dev` in dev environment.

Given your normal start script is:

```json
{
  "scripts": {
    "start": "jerni start my-journey.js"
  }
}
```

Add a new `dev` script as follow

```json
{
  "scripts": {
    "dev": "jerni-dev start my-journey.js",
    "start": "jerni start my-journey.js"
  }
}
```
