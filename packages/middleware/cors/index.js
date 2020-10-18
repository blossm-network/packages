const deps = require("./deps");

module.exports = ({ app, allow, credentials = false, methods = [] }) => {
  app.use(
    deps.cors({
      origin: deps.allow([`https://${process.env.NETWORK}`, ...allow]).check,
      methods: methods.join(","),
      preflightContinue: false,
      optionsSuccessStatus: 204,
      credentials,
    })
  );
  app.options("*", deps.cors());
};
