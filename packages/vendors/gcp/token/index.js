const deps = require("./deps");

const serverId = () => {
  switch (process.env.NODE_ENV) {
    case "development":
      return process.env.GCP_DEVELOPMENT_COMPUTE_URL_ID; //"p3u6hkyfwa";
    case "staging":
      return process.env.GCP_STAGING_COMPUTE_URL_ID; //"p3u6hkyfwa";
    case "sandbox":
      return process.env.GCP_SANDBOX_COMPUTE_URL_ID; //"ixixyzl3ea";
    case "production":
      return process.env.GCP_PRODUCTION_COMPUTE_URL_ID; //"qzhmgyrp2q";
    default:
      return null;
  }
};

///https://cloud.google.com/run/docs/authenticating/service-to-service
module.exports = async ({ name, hash }) => {
  const id = serverId();

  if (!id) return null;

  const metadataServerTokenUrl =
    "http://metadata/computeMetadata/v1/instance/service-accounts/default/identity?audience=";

  const headers = { "Metadata-Flavor": "Google" };

  const url = `https://${process.env.GCP_REGION}-${name}-${hash}-${id}-uc.a.run.app`;

  const response = await deps.get(metadataServerTokenUrl + url, { headers });

  if (response.statusCode >= 300) return null;
  return response.body;
};
