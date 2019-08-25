const deps = require("../deps");
const { action, domain, service } = require("../config");

const { SECONDS_IN_MONTH } = require("@sustainer-network/consts");

const THREE_MONTHS = 3 * SECONDS_IN_MONTH;

module.exports = async params => {
  const root = await deps.newUuid();

  const isStaging = process.env.NODE_ENV == "staging";

  const issuer = `${action}.${domain}.${service}.${
    isStaging ? "staging." : ""
  }${process.env.NETWORK}`;

  const token = await deps.createJwt({
    options: {
      issuer,
      subject: params.payload.subject,
      audience: params.payload.audiences.join(","),
      expiresIn: THREE_MONTHS
    },
    data: {
      root,
      ...params.payload.metadata
    },
    secret: process.env.SECRET
  });

  const payload = {
    token,
    issuerInfo: params.issuerInfo
  };

  return { payload, response: { token } };
};
