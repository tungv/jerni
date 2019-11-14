# A simple app using jerni with a MongoDB store

In this demo, we will start an express server that serves 2 endpoints:

1. GET `/api/users`, and
2. POST `/api/users`

`User` model has 3 properties:

- `id`: is a unique string ID
- `fullName`: string
- `email`: string

# Getting started

> Before you start, make sure your machine has:
>
> 1. node v10 is required but node v12 is prefered.
> 2. mongodb is listening on localhost:27017

To start developing, you don't need to set up a full-pledge `heq-server`.
`jerni-dev` provides a toolkit for your development with:

- editable filesystem events log
- hot code reload for your database projection

You need to run 2 commands below in two **separate terminals**

1. `yarn webserver` to start your express app on port 3000
2. `yarn jerni-dev` to start your background event projection service

_note that I'm using yarn in this document but you can use `npm run` as your preference._

To create a new user, run this in your terminal

```bash
curl localhost:3000/api/users -H"content-type: application/json" -d '{"fullName":"test","email":"test"}'
```

By doing that, you just created a new event, describing there was a new user registering on our website.
Your mongodb database will insert a new row and when it's done, your POST handler will send a JSON representing
that new user back to your terminal screen.
