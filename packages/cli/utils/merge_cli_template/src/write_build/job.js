const yarnInstall = require("./steps/yarn_install");
const unitTests = require("./steps/unit_tests");
const baseUnitTests = require("./steps/base_unit_tests");
const buildImage = require("./steps/build_image");
const dockerComposeUp = require("./steps/docker_compose_up");
const dockerComposeProcesses = require("./steps/docker_compose_processes");
const baseIntegrationTests = require("./steps/base_integration_tests");
const integrationTests = require("./steps/integration_tests");
const dockerComposeLogs = require("./steps/docker_compose_logs");
const dockerPush = require("./steps/docker_push");
const deployRun = require("./steps/deploy_run");
const startDnsTransaction = require("./steps/start_dns_transaction");
const addDnsTransaction = require("./steps/add_dns_transaction");
const executeDnsTransaction = require("./steps/execute_dns_transaction");
const abortDnsTransaction = require("./steps/abort_dns_transaction");
const mapDomain = require("./steps/map_domain");
const writeEnv = require("./steps/write_env");
const createQueue = require("./steps/create_queue");
const updateQueue = require("./steps/update_queue");

module.exports = ({
  name,
  domain,
  region,
  project,
  envUriSpecifier,
  coreNetwork,
  dnsZone,
  service,
  procedure,
  localCoreNetwork,
  localNetwork,
  network,
  env,
  host,
  operationHash,
  serviceName,
  computeUrlId,
  timeout,
  memory,
  containerRegistery,
  mainContainerName,
  uri,
  envVars,
  devEnvVars,
  rolesBucket,
  secretBucket,
  secretBucketKeyLocation,
  secretBucketKeyRing,
  imageExtension,
  runUnitTests,
  runBaseUnitTests,
  runIntegrationTests,
  redisIp,
  runBaseIntegrationTests,
  dependencyKeyEnvironmentVariables,
  strict,
}) => {
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
      host,
      serviceName,
      localCoreNetwork,
      localNetwork,
      operationHash,
      secretBucket,
      secretBucketKeyRing,
      secretBucketKeyLocation,
      custom: {
        NAME: name,
        ...dependencyKeyEnvironmentVariables,
        ...(domain && { DOMAIN: domain }),
        ...(service && { SERVICE: service }),
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
            serviceName,
            procedure,
            extension: imageExtension,
            rolesBucket,
            secretBucket,
            secretBucketKeyLocation,
            secretBucketKeyRing,
            containerRegistery,
            envUriSpecifier,
            operationHash,
            computeUrlId,
            coreNetwork,
            timeout,
            memory,
            network,
            region,
            project,
            redisIp,
            nodeEnv: env,
            env: {
              NAME: name,
              ...(domain && { DOMAIN: domain }),
              ...(service && { SERVICE: service }),
              ...dependencyKeyEnvironmentVariables,
              ...envVars,
              ...devEnvVars,
            },
            labels: {
              name,
              ...(domain && { domain }),
              ...(service && { service }),
            },
          }),
          createQueue({
            name: `job${service ? `-${service}` : ""}${
              domain ? `-${domain}` : ""
            }-${name}`,
            project,
            maxDispatchPerSecond: 100,
            maxConcurrentDispatches: 100,
          }),
          updateQueue({
            name: `job${service ? `-${service}` : ""}${
              domain ? `-${domain}` : ""
            }-${name}`,
            project,
            maxDispatchPerSecond: 100,
            maxConcurrentDispatches: 100,
          }),
          startDnsTransaction({ dnsZone, project }),
          addDnsTransaction({ uri, dnsZone, project }),
          executeDnsTransaction({ dnsZone, project }),
          abortDnsTransaction({ dnsZone, project }),
          mapDomain({
            serviceName,
            uri,
            project,
            region,
          }),
        ]
      : [dockerComposeLogs]),
  ];
};
