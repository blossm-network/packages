const normalize = require("@blossm/normalize-cli");
const roboSay = require("@blossm/robo-say");
const mergeCliTemplate = require("@blossm/merge-cli-template");
const testCliTemplate = require("@blossm/test-cli-template");
const fs = require("fs-extra");
const { spawn } = require("child_process");
const rootDir = require("@blossm/cli-root-dir");
const path = require("path");
const { green } = require("chalk");
const os = require("os");

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

const build = async ({ workingDir, env }) => {
  const blossmConfig = rootDir.config();

  for (const e of env == "all"
    ? ["development", "staging", "sandbox", "production"]
    : [env]) {
    spawn(
      "gcloud",
      [
        "builds",
        "submit",
        ".",
        "--config=build.yaml",
        `--project=${envProject({ config: blossmConfig, env: e })}`,
      ],
      {
        stdio: [process.stdin, process.stdout, process.stderr],
        cwd: workingDir,
      }
    );
  }
  // spawnSync(
  //   "gcloud",
  //   [
  //     "builds",
  //     "submit",
  //     ".",
  //     "--config=build.yaml",
  //     `--project=${envProject({ config: blossmConfig, env })}`,
  //   ],
  //   {
  //     stdio: [process.stdin, process.stdout, process.stderr],
  //     cwd: workingDir,
  //   }
  // );
};

module.exports = ({ domain, dir }) => async (args, configFn) => {
  const input = await normalize({
    entrypointType: "path",
    entrypointDefault: ".",
    args,
    flags: [
      {
        name: "unit-test",
        short: "t",
        type: Boolean,
        default: false,
      },
      {
        name: "env",
        type: String,
        short: "e",
        choices: ["production", "sandbox", "staging", "development"],
        default: "development",
      },
      {
        name: "dry-run",
        type: Boolean,
        short: "d",
        default: false,
      },
    ],
  });

  const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), "blossm-"));
  //eslint-disable-next-line no-console
  console.log(roboSay(`Assembling template into ${workingDir}...`));

  await mergeCliTemplate({
    scriptDir: dir,
    workingDir,
    env: input.env,
    path: input.path,
    dry: input.dryRun,
    configFn,
  });

  try {
    if (input.unitTest) {
      //eslint-disable-next-line no-console
      console.log(roboSay("Running your tests..."));
      await testCliTemplate({ workingDir, input });
      fs.removeSync(workingDir);
      //eslint-disable-next-line no-console
      console.log(roboSay("Woohoo!"), green.bold("done"));
    } else {
      //eslint-disable-next-line no-console
      console.log(
        roboSay(
          `Deploying your ${domain
            .split("-")
            .join(
              " "
            )}... It might take 5 minutes or so, maybe 4 on a good day.`
        )
      );

      await build({ workingDir, env: input.env });
      fs.removeSync(workingDir);
      //eslint-disable-next-line no-console
      console.log(roboSay("Woohoo!"), green.bold("done"));
    }
  } catch (e) {
    fs.removeSync(workingDir);
  }
};
