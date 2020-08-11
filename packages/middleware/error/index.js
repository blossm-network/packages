const logger = require("@blossm/logger");

module.exports = (err, _, res, next) => {
  //TODO
  console.log({ err });

  if (res.headersSent) return next(err);

  if (!err.statusCode || err.statusCode >= 500) {
    logger.error("A server error occured: ", { err, stack: err.stack });
  }

  //If unauthorized, remove cookie; TODO change to 'access'
  if (err.statusCode === 401) res.clearCookie("access");

  res.status(err.statusCode || 500).send(err);
  next();
};
