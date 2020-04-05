const antenna = require("@blossm/command-antenna");
const eventStore = require("@blossm/event-store-rpc");
const { verify: verifyGCP } = require("@blossm/gcp-kms");
const { verify } = require("@blossm/verify-access-token");
const gcpToken = require("@blossm/gcp-token");
const { compare } = require("@blossm/crypt");
const { invalidCredentials } = require("@blossm/errors");

const config = require("./config.json");

module.exports = antenna({
  whitelist: config.whitelist,
  verifyFn: ({ key }) =>
    key == "access"
      ? verify({
          url: process.env.PUBLIC_KEY_URL,
          algorithm: "SHA256"
        })
      : verifyGCP({
          ring: "jwt",
          key,
          location: "global",
          version: "1",
          project: process.env.GCP_PROJECT
        }),
  terminatedSessionCheckFn: async ({ session }) => {
    const aggregate = await eventStore({
      domain: "session",
      service: "core"
    })
      .set({ tokenFn: gcpToken })
      .aggregate(session);

    if (aggregate.state.terminated) throw invalidCredentials.tokenTerminated();
  },
  keyClaimsFn: async ({ id, secret }) => {
    const [key] = await eventStore({ domain: "key", service: "core" })
      .set({ tokenFn: gcpToken })
      .query({ key: "id", value: id });

    if (!key) throw "Key not found";

    if (!(await compare(secret, key.state.secret))) throw "Incorrect secret";

    return {
      context: {
        key: {
          root: key.headers.root,
          service: process.env.SERVICE,
          network: process.env.NETWORK
        },
        principle: key.state.principle,
        node: key.state.node,
        domain: "node"
      }
    };
  }
});
