const fs = require("fs");
const path = require("path");
const commandProcedure = require("@blossm/command");
const command = require("@blossm/command-rpc");
const fact = require("@blossm/fact-rpc");
const eventStore = require("@blossm/event-store-rpc");
const nodeExternalToken = require("@blossm/node-external-token");
const gcpToken = require("@blossm/gcp-token");
const { enqueue } = require("@blossm/gcp-queue");

const main = require("./main.js");
const validate =
  fs.existsSync(path.resolve(__dirname, "./validate.js")) &&
  require("./validate");
const normalize =
  fs.existsSync(path.resolve(__dirname, "./normalize.js")) &&
  require("./normalize");
const fill =
  fs.existsSync(path.resolve(__dirname, "./fill.js")) && require("./fill");

const config = require("./config.json");

module.exports = commandProcedure({
  mainFn: main,
  ...(config.contexts && { contexts: config.contexts }),
  ...(validate && { validateFn: validate }),
  ...(normalize && { normalizeFn: normalize }),
  ...(fill && { fillFn: fill }),
  aggregateFn: ({ context, claims, token }) => async (
    root,
    {
      domain = process.env.DOMAIN,
      service = process.env.SERVICE,
      network = process.env.NETWORK,
    } = {}
  ) => {
    const { body: aggregate } = await eventStore({ domain, service, network })
      .set({
        ...(context && { context }),
        ...(claims && { claims }),
        ...(token && { currentToken: token }),
        token: { internalFn: gcpToken },
      })
      .aggregate(root);

    return {
      lastEventNumber: aggregate.headers.lastEventNumber,
      state: aggregate.state,
      root: aggregate.headers.root,
    };
  },
  commandFn: ({ path, idempotency, context, claims, token, txId, ip }) => ({
    name,
    domain,
    service,
    network,
    payload,
    root,
    options,
    context: contextOverride = context,
    claims: claimsOverride = claims,
    async = false,
    wait = 0,
    principal = "user",
  }) =>
    command({
      name,
      domain,
      ...(service && { service }),
      ...(network && { network }),
    })
      .set({
        ...(contextOverride && { context: contextOverride }),
        ...(claimsOverride && { claims: claimsOverride }),
        ...(token && { currentToken: token }),
        token: {
          internalFn: gcpToken,
          externalFn: ({ network, key } = {}) =>
            principal == "user"
              ? { token, type: "Bearer" }
              : nodeExternalToken({ network, key }),
        },
        ...(async && { enqueue: { fn: enqueue, wait } }),
      })
      .issue(payload, {
        ...(root && { root }),
        ...(options && { options }),
        headers: {
          ...(idempotency && { idempotency }),
        },
        tx: {
          ...(ip && { ip }),
          ...(txId && { id: txId }),
          ...(path && { path }),
        },
      }),
  queryAggregatesFn: ({ context, claims, token }) => async ({
    domain,
    service,
    network,
    key,
    value,
    context: contextOverride = context,
    claims: claimsOverride = claims,
    principal = "user",
  }) => {
    const { body: aggregates } = await eventStore({
      domain,
      ...(service && { service }),
      ...(network && { network }),
    })
      .set({
        ...(contextOverride && { context: contextOverride }),
        ...(claimsOverride && { claims: claimsOverride }),
        ...(token && { currentToken: token }),
        token: {
          internalFn: gcpToken,
          externalFn: ({ network, key } = {}) =>
            principal == "user"
              ? { token, type: "Bearer" }
              : nodeExternalToken({ network, key }),
        },
      })
      .query({ key, value });
    return aggregates.map((aggregate) => ({
      root: aggregate.headers.root,
      state: aggregate.state,
    }));
  },
  readFactFn: ({ context, claims, token }) => ({
    name,
    domain,
    service,
    network,
    query,
    id,
    context: contextOverride = context,
    claims: claimsOverride = claims,
    principal = "user",
  }) =>
    fact({
      name,
      ...(domain && { domain }),
      service,
      ...(network && { network }),
    })
      .set({
        ...(contextOverride && { context: contextOverride }),
        ...(claimsOverride && { claims: claimsOverride }),
        ...(token && { currentToken: token }),
        token: {
          internalFn: gcpToken,
          externalFn: ({ network, key } = {}) =>
            principal == "user"
              ? { token, type: "Bearer" }
              : nodeExternalToken({ network, key }),
        },
      })
      .read({ query, id }),
  streamFactFn: ({ context, claims, token }) => ({
    name,
    domain,
    service,
    network,
    query,
    sort,
    id,
    context: contextOverride = context,
    claims: claimsOverride = claims,
    principal = "user",
    fn,
  }) =>
    fact({
      name,
      domain,
      ...(service && { service }),
      ...(network && { network }),
    })
      .set({
        ...(contextOverride && { context: contextOverride }),
        ...(claimsOverride && { claims: claimsOverride }),
        ...(token && { currentToken: token }),
        token: {
          internalFn: gcpToken,
          externalFn: ({ network, key } = {}) =>
            principal == "user"
              ? { token, type: "Bearer" }
              : nodeExternalToken({ network, key }),
        },
      })
      .stream(fn, { query, sort, id }),
  addFn: ({ domain, service, context, claims, eventData, tx, async }) =>
    eventStore({ domain, service })
      .set({
        ...(context && { context }),
        ...(claims && { claims }),
        token: {
          internalFn: gcpToken,
        },
        ...(async && { enqueue: { fn: enqueue } }),
      })
      .add({ eventData, tx }),
  countFn: ({ context, claims, token }) => ({ domain, service, root }) =>
    eventStore({ domain, service })
      .set({
        ...(context && { context }),
        ...(claims && { claims }),
        ...(token && { currentToken: token }),
        token: {
          internalFn: gcpToken,
        },
      })
      .count(root),
});
