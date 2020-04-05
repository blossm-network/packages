const { promisify } = require("util");
const { readFile, readdir, unlink } = require("fs");
const yaml = require("yaml");
const gateway = require("@blossm/get-job-gateway");
const eventStore = require("@blossm/event-store-rpc");
const { verify: verifyGCP } = require("@blossm/gcp-kms");
const { verify } = require("@blossm/verify-access-token");
const { invalidCredentials } = require("@blossm/errors");
const { download: downloadFile } = require("@blossm/gcp-storage");
const rolePermissions = require("@blossm/role-permissions");
const gcpToken = require("@blossm/gcp-token");
const uuid = require("@blossm/uuid");

const readFileAsync = promisify(readFile);
const readDirAsync = promisify(readdir);
const unlinkAsync = promisify(unlink);

const config = require("./config.json");

let defaultRoles;

module.exports = gateway({
  jobs: config.jobs,
  whitelist: config.whitelist,
  tokenFn: gcpToken,
  permissionsLookupFn: async ({ principle }) => {
    if (!defaultRoles) {
      const fileName = uuid();
      const extension = ".yaml";
      defaultRoles = {};
      await downloadFile({
        bucket: process.env.GCP_ROLES_BUCKET,
        destination: fileName + extension
      });
      const files = (await readDirAsync(".")).filter(
        file => file.startsWith(fileName) && file.endsWith(extension)
      );

      await Promise.all(
        files.map(async file => {
          const role = await readFileAsync(file);
          const defaultRole = yaml.parse(role.toString());
          defaultRoles = {
            ...defaultRoles,
            ...defaultRole
          };
          await unlinkAsync(file);
        })
      );
    }

    const aggregate = await eventStore({
      domain: "principle",
      service: "core"
    })
      .set({ tokenFn: gcpToken })
      .aggregate(principle.root);

    return aggregate
      ? await rolePermissions({
          roles: aggregate.state.roles.map(role => role.id),
          defaultRoles,
          customRolePermissionsFn: async ({ roleId }) => {
            const role = await eventStore({ domain: "role", service: "core" })
              .set({ tokenFn: gcpToken })
              .query({ key: "id", value: roleId });
            return role.state.permissions;
          }
        })
      : [];
  },
  terminatedSessionCheckFn: async ({ session }) => {
    const aggregate = await eventStore({
      domain: "session",
      service: "core"
    })
      .set({ tokenFn: gcpToken })
      .aggregate(session);

    if (aggregate.state.terminated) throw invalidCredentials.tokenTerminated();
  },
  verifyFn: ({ key }) =>
    key == "access"
      ? verify({
          url: process.env.PUBLIC_KEY_URL,
          algorithm: "SHA256"
        })
      : verifyGCP({
          ring: "jwt",
          key,
          location: "global",
          version: "1",
          project: process.env.GCP_PROJECT
        })
});
