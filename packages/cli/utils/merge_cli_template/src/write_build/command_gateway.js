const yarnInstall = require("./steps/yarn_install");
const unitTests = require("./steps/unit_tests");
const baseUnitTests = require("./steps/base_unit_tests");
const buildImage = require("./steps/build_image");
const dockerComposeUp = require("./steps/docker_compose_up");
const dockerComposeProcesses = require("./steps/docker_compose_processes");
const integrationTests = require("./steps/integration_tests");
const baseIntegrationTests = require("./steps/base_integration_tests");
const dockerComposeLogs = require("./steps/docker_compose_logs");
const dockerPush = require("./steps/docker_push");
const deployRun = require("./steps/deploy_run");
const startDnsTransaction = require("./steps/start_dns_transaction");
const addDnsTransaction = require("./steps/add_dns_transaction");
const executeDnsTransaction = require("./steps/execute_dns_transaction");
const abortDnsTransaction = require("./steps/abort_dns_transaction");
const mapDomain = require("./steps/map_domain");
const writeEnv = require("./steps/write_env");

module.exports = ({
  domain,
  region,
  project,
  network,
  publicKeyUrl,
  envUriSpecifier,
  containerRegistery,
  mainContainerName,
  serviceName,
  dnsZone,
  service,
  procedure,
  memory,
  localCoreNetwork,
  localNetwork,
  timeout,
  env,
  host,
  operationHash,
  computeUrlId,
  dependencyKeyEnvironmentVariables,
  rolesBucket,
  coreNetwork,
  secretBucket,
  secretBucketKeyLocation,
  secretBucketKeyRing,
  envVars,
  devEnvVars,
  imageExtension,
  runUnitTests,
  runBaseUnitTests,
  runIntegrationTests,
  runBaseIntegrationTests,
  strict,
}) => {
  const authUri = `c.${domain}.${service}.${envUriSpecifier}${network}`;
  return [
    yarnInstall,
    ...(runUnitTests ? [unitTests] : []),
    ...(runBaseUnitTests ? [baseUnitTests] : []),
    buildImage({
      extension: imageExtension,
      containerRegistery,
      procedure,
    }),
    writeEnv({
      mainContainerName,
      project,
      region,
      procedure,
      localCoreNetwork,
      localNetwork,
      operationHash,
      secretBucket,
      secretBucketKeyRing,
      secretBucketKeyLocation,
      serviceName,
      custom: {
        DOMAIN: domain,
        SERVICE: service,
        ...dependencyKeyEnvironmentVariables,
        ...(publicKeyUrl && { PUBLIC_KEY_URL: publicKeyUrl }),
        ...envVars,
        ...devEnvVars,
      },
    }),
    dockerComposeUp,
    dockerComposeProcesses,
    ...(runBaseIntegrationTests ? [baseIntegrationTests({ strict })] : []),
    ...(runIntegrationTests ? [integrationTests({ strict })] : []),
    ...(strict
      ? [
          dockerPush({
            extension: imageExtension,
            containerRegistery,
            procedure,
          }),
          deployRun({
            extension: imageExtension,
            serviceName,
            coreNetwork,
            allowUnauthenticated: true,
            procedure,
            operationHash,
            computeUrlId,
            rolesBucket,
            secretBucket,
            secretBucketKeyLocation,
            secretBucketKeyRing,
            containerRegistery,
            nodeEnv: env,
            host,
            timeout,
            memory,
            region,
            project,
            network,
            envUriSpecifier,
            env: {
              DOMAIN: domain,
              SERVICE: service,
              ...dependencyKeyEnvironmentVariables,
              ...(publicKeyUrl && { PUBLIC_KEY_URL: publicKeyUrl }),
              ...envVars,
            },
            labels: { domain, service },
          }),
          startDnsTransaction({ dnsZone, project }),
          addDnsTransaction({ uri: authUri, dnsZone, project }),
          executeDnsTransaction({ dnsZone, project }),
          abortDnsTransaction({ dnsZone, project }),
          mapDomain({
            uri: authUri,
            project,
            region,
            serviceName,
          }),
        ]
      : [dockerComposeLogs]),
  ];
};
