const { object, string, date, findError } = require("@blossm/validator");
const { MILLISECONDS_IN_HOUR } = require("@blossm/duration-consts");

const deps = require("./deps");

module.exports = async (params) => {
  const error = findError([
    object(params.headers, { title: "headers", path: "headers" }),
    object(params.payload, {
      optional: true,
      title: "payload",
      path: "payload",
    }),
    string(params.root, {
      optional: true,
      title: "root",
      path: "root",
    }),
  ]);

  if (error) throw error;

  const headersError = findError([
    string(params.headers.idempotency, {
      optional: true,
      title: "idempotency",
      path: "headers.idempotency",
    }),
    date(params.headers.issued, {
      title: "issued date",
      headers: "headers.issued",
    }),
  ]);

  if (headersError) throw headersError;

  if (
    new Date(params.headers.issued).getTime() - new Date().getTime() >
    MILLISECONDS_IN_HOUR
  ) {
    throw deps.badRequestError.message("The issued timestamp seems incorrect.");
  }
};
