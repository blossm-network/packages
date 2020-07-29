const logger = require("@blossm/logger");

const deps = require("../deps");

module.exports = async ({
  protocol,
  user,
  password,
  host,
  database,
  parameters,
  poolSize = 5,
  autoIndex = false,
  onOpen = () => logger.info("Thank you database."),
  onError = (err) => logger.error("Database has errored.", { err }),
}) => {
  const connectionString = deps.urlEncodeQueryData(
    `${protocol}://${user}:${password}@${host}/${database}`,
    ...(parameters ? [parameters] : [])
  );

  await deps.mongoose.connect(connectionString, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    autoIndex,
    poolSize,
  });

  const db = deps.mongoose.connection;

  if (onError != undefined) db.on("error", onError);

  if (onOpen != undefined) db.once("open", onOpen);

  return db;
};
