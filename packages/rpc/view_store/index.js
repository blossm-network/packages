const deps = require("./deps");

module.exports = ({ name, context = process.env.CONTEXT, network }) => {
  const internal = !network || network == process.env.NETWORK;
  const read = ({
    contexts,
    currentToken,
    token: {
      internalFn: internalTokenFn,
      externalFn: externalTokenFn,
      key,
    } = {},
  } = {}) => ({ query, sort, text, id, skip, limit, bootstrap } = {}) =>
    deps
      .rpc(name, ...(context ? [context] : []), "view-store")
      .get({
        ...(query && { query }),
        ...(text && { text }),
        ...(skip && { skip }),
        ...(limit && { limit }),
        ...(bootstrap && { bootstrap }),
        ...(sort && { sort }),
        ...(id && { id }),
      })
      .in({
        ...(contexts && { context: contexts }),
        ...(!internal && {
          network,
          host: `v${context ? `.${context}` : ""}.${network}`,
        }),
      })
      .with({
        ...(internalTokenFn && { internalTokenFn }),
        ...(externalTokenFn && { externalTokenFn }),
        ...(currentToken && { currentToken }),
        ...(key && { key }),
        ...(!internal && { path: `/${name}` }),
      });
  const idStream = ({
    contexts,
    currentToken,
    token: {
      internalFn: internalTokenFn,
      externalFn: externalTokenFn,
      key,
    } = {},
  } = {}) => async (fn, { query, sort, parallel } = {}) =>
    await deps
      .rpc(name, ...(context ? [context] : []), "view-store")
      .stream(fn, {
        ...(query && { query }),
        ...(sort && { sort }),
        ...(parallel && { parallel }),
      })
      .in({
        ...(contexts && { context: contexts }),
        ...(!internal && {
          network,
          host: `v${context ? `.${context}` : ""}.${network}`,
        }),
      })
      .with({
        path: `/${internal ? "" : `${name}/`}stream-ids`,
        ...(internalTokenFn && { internalTokenFn }),
        ...(externalTokenFn && { externalTokenFn }),
        ...(currentToken && { currentToken }),
        ...(key && { key }),
      });
  const update = ({
    contexts,
    token: { internalFn: internalTokenFn } = {},
    enqueue: { fn: enqueueFn, wait: enqueueWait } = {},
  } = {}) => ({ id, query, update, arrayFilters, groups, trace }) =>
    deps
      .rpc(name, ...(context ? [context] : []), "view-store")
      .put(id, {
        ...(trace && { trace }),
        ...(query && { query }),
        ...(arrayFilters && { arrayFilters }),
        ...(groups && { groups }),
        update,
      })
      .in({
        ...(contexts && { context: contexts }),
      })
      .with({
        ...(internalTokenFn && { internalTokenFn }),
        ...(enqueueFn && {
          enqueueFn: enqueueFn({
            queue: `view-store${context ? `-${context}` : ""}-${name}`,
            ...(enqueueWait && { wait: enqueueWait }),
          }),
        }),
      });
  const del = ({
    contexts,
    token: { internalFn: internalTokenFn } = {},
  } = {}) => (query) =>
    deps
      .rpc(name, ...(context ? [context] : []), "view-store")
      .delete(query)
      .in({
        ...(contexts && { context: contexts }),
      })
      .with({
        ...(internalTokenFn && { internalTokenFn }),
      });
  return {
    set: ({ context: contexts, token, currentToken, enqueue }) => {
      return {
        read: read({ contexts, token, currentToken }),
        idStream: idStream({ contexts, token, currentToken }),
        update: update({ contexts, token, enqueue }),
        delete: del({ contexts, token }),
      };
    },
    read: read(),
    idStream: idStream(),
    update: update(),
    delete: del(),
  };
};
