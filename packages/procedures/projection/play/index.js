const deps = require("./deps");

const data = (req) => {
  try {
    const dataString = Buffer.from(req.body.message.data, "base64")
      .toString()
      .trim();
    return JSON.parse(dataString);
  } catch (e) {
    throw deps.badRequestError.message("Invalid data format.");
  }
};

module.exports = ({ mainFn, aggregateFn, readFactFn }) => async (req, res) => {
  const { root, action, domain, service, push = true } = req.body.message
    ? data(req)
    : { ...req.body, action: undefined, push: false };

  const aggregate = await aggregateFn({
    root,
    domain,
    service,
  });

  await mainFn({
    aggregate,
    aggregateFn,
    readFactFn,
    push,
    ...(action && { action }),
  });

  res.sendStatus(204);
};