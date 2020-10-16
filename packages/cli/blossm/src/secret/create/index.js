const { prompt } = require("inquirer");
const normalize = require("@blossm/normalize-cli");
const roboSay = require("@blossm/robo-say");
const { create: createSecret } = require("@blossm/gcp-secret");
const rootDir = require("@blossm/cli-root-dir");
const fs = require("fs");
const path = require("path");

const envProject = ({ env, config }) => {
  switch (env) {
    case "production":
      return config.vendors.cloud.gcp.projects.production;
    case "sandbox":
      return config.vendors.cloud.gcp.projects.sandbox;
    case "staging":
      return config.vendors.cloud.gcp.projects.staging;
    case "development":
      return config.vendors.cloud.gcp.projects.development;
    default:
      return "";
  }
};

const envSecretsBucket = ({ env, config }) => {
  switch (env) {
    case "production":
      return config.vendors.cloud.gcp.secretsBuckets.production;
    case "sandbox":
      return config.vendors.cloud.gcp.secretsBuckets.sandbox;
    case "staging":
      return config.vendors.cloud.gcp.secretsBuckets.staging;
    case "development":
      return config.vendors.cloud.gcp.secretsBuckets.development;
    default:
      return "";
  }
};

const create = async (input) => {
  const env = input.env;

  const blossmConfig = rootDir.config();

  const message =
    input.message ||
    fs.readFileSync(path.resolve(process.cwd(), input.file), "utf8");

  //TODO remove
  console.log({ message });
  await createSecret(input.name, message, {
    project: envProject({ config: blossmConfig, env }),
    ring: "secrets-bucket",
    location: "global",
    bucket: envSecretsBucket({ config: blossmConfig, env }),
  });
  //eslint-disable-next-line no-console
  console.log(
    roboSay("All done. Your secret has been encrypted and uploaded.")
  );
};

module.exports = async (args) => {
  const input = await normalize({
    entrypointType: "name",
    args,
    flags: [
      {
        name: "message",
        short: "m",
        type: String,
      },
      {
        name: "file",
        short: "f",
        type: String,
      },
      {
        name: "env",
        short: "e",
        type: String,
        choices: ["production", "sandbox", "staging", "development"],
        default: "development",
      },
    ],
  });
  if (!input.message && !input.file) {
    const { message } = await prompt({
      type: "string",
      name: "message",
      message: roboSay(`What's the secret?`),
    });
    input.message = message;
  }
  if (!input.env) {
    const { env } = await prompt({
      type: "list",
      choices: ["production", "sandbox", "staging", "development"],
      name: "env",
      message: roboSay(`What environment is this for?`),
    });
    input.env = env;
  }

  create(input);
};
