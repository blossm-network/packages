const normalize = require("@blossm/normalize-cli");
const roboSay = require("@blossm/robo-say");
const mergeCliTemplate = require("@blossm/merge-cli-template");
const testCliTemplate = require("@blossm/test-cli-template");
const fs = require("fs-extra");
const { spawnSync } = require("child_process");
const rootDir = require("@blossm/cli-root-dir");
const path = require("path");
const { green, red } = require("chalk");
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

  await new Promise(function (resolve, reject) {
    const { error } = spawnSync(
      "gcloud",
      [
        "builds",
        "submit",
        ".",
        "--config=build.yaml",
        `--project=${envProject({ config: blossmConfig, env })}`,
      ],
      {
        stdio: [process.stdin, process.stdout, process.stderr],
        cwd: workingDir,
      }
    );
    return error ? reject(error) : resolve();
  });
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
        choices: ["production", "sandbox", "staging", "development", "all"],
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

  await Promise.all(
    (input.env == "all"
      ? ["development", "staging", "sandbox", "production"]
      : [input.env]
    ).map(async (e) => {
      const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), "blossm-"));
      //eslint-disable-next-line no-console
      console.log(
        roboSay(`Deploying ${e} by assembling template into ${workingDir}...`)
      );

      await mergeCliTemplate({
        scriptDir: dir,
        workingDir,
        env: e,
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
          console.log(roboSay(""), green.bold("done"));
        } else {
          const modules = "node_modules";
          const lock = "yarn.lock";

          const modulesPath = path.resolve(process.cwd(), modules);
          const lockPath = path.resolve(process.cwd(), lock);

          fs.removeSync(modulesPath);
          fs.removeSync(lockPath);

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

          await build({ workingDir, env: e });
          fs.removeSync(workingDir);
          //eslint-disable-next-line no-console
          console.log(roboSay(), green.bold("done"));
        }
      } catch (e) {
        fs.removeSync(workingDir);
        //eslint-disable-next-line no-console
        console.log(roboSay("Something went wrong"), red.bold("error"));
      }
    })
  );
};
