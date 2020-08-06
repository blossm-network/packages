const deps = require("../deps");

module.exports = (whitelist) => {
  return {
    check: (origin, callback) => {
      //TODO
      console.log({ whitelist, origin });
      if (!origin || whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(deps.unauthorizedError.message("Not allowed by CORS."));
      }
    },
  };
};
