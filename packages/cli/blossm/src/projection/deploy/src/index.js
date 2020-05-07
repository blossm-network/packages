const eventHandler = require("@blossm/mongodb-event-handler");
const command = require("@blossm/command-rpc");
const viewStore = require("@blossm/view-store-rpc");
const eventStore = require("@blossm/event-store-rpc");
const gcpToken = require("@blossm/gcp-token");
const externalToken = require("@blossm/external-token");
const channelName = require("@blossm/channel-name");

const main = require("./main.js");

const config = require("./config.json");

module.exports = eventHandler({
  mainFn: (state, event) => {
    const {
      [process.env.DOMAIN]: {
        root: domainRoot,
        service: domainService,
        network: domainNetwork,
      } = {},
      body,
    } = main(state, event);

    return {
      root: event.headers.root,
      headers: {
        ...(event.headers.context &&
          event.headers.context[process.env.CONTEXT] && {
            [process.env.CONTEXT]: event.headers.context[process.env.CONTEXT],
          }),
        ...(process.env.DOMAIN &&
          domainRoot &&
          domainService &&
          domainNetwork && {
            [process.env.DOMAIN]: {
              root: domainRoot,
              service: domainService,
              network: domainNetwork,
            },
          }),
      },
      body: {
        ...body,
        ...(event.headers.trace && { trace: event.headers.trace }),
      },
    };
  },
  commitFn: async (state) => {
    const { body: newView } = await viewStore({
      name: config.name,
      ...(config.domain && { domain: config.domain }),
      ...(config.service && { service: config.service }),
      context: config.context,
    })
      .set({
        tokenFns: { internal: gcpToken },
      })
      .update(state.root, {
        headers: state.headers,
        body: state.body,
      });

    //TODO
    //eslint-disable-next-line no-console
    console.log({ newView, json: JSON.stringify(newView) });

    const channel = channelName({
      name: process.env.NAME,
      ...(process.env.DOMAIN && {
        domain: process.env.DOMAIN,
        domainRoot: newView.headers[process.env.DOMAIN].root,
        domainService: newView.headers[process.env.DOMAIN].service,
        domainNetwork: newView.headers[process.env.DOMAIN].network,
      }),
      context: process.env.CONTEXT,
      contextRoot: newView.headers[process.env.CONTEXT].root,
      contextService: newView.headers[process.env.CONTEXT].service,
      contextNetwork: newView.headers[process.env.CONTEXT].network,
    });

    //TODO
    //eslint-disable-next-line no-console
    console.log({ channel });

    command({
      name: "push",
      domain: "update",
      service: "system",
      network: process.env.CORE_NETWORK,
    })
      .set({
        tokenFns: { external: externalToken, internal: gcpToken },
      })
      .issue({
        view: newView,
        channel,
      });
  },
  streamFn: ({ root, from }, fn) =>
    eventStore({
      domain: process.env.EVENT_DOMAIN,
      service: process.env.EVENT_SERVICE,
    })
      .set({
        tokenFns: { internal: gcpToken },
      })
      .stream(fn, { root, from }),
});
