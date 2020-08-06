const deps = require("./deps");

module.exports = async ({
  commands,
  domain = process.env.DOMAIN,
  service = process.env.SERVICE,
  internalTokenFn,
  nodeExternalTokenFn,
  algorithm,
  audience,
  whitelist,
  permissionsLookupFn,
  terminatedSessionCheckFn,
  verifyFn,
  keyClaimsFn,
  redirect,
}) => {
  let server = deps.server({
    prehook: (app) =>
      deps.corsMiddleware({
        app,
        whitelist,
        credentials: true,
        methods: ["POST"],
      }),
  });

  for (const {
    name,
    network,
    service: commandService,
    key = "access",
    privileges,
    protection = "strict",
    basic = false,
    context,
  } of commands) {
    server = server.post(
      deps.post({
        name,
        domain,
        service: commandService || service,
        ...(network && { network }),
        internalTokenFn,
        nodeExternalTokenFn,
        key,
        ...(redirect && { redirect }),
        ...(context && { context }),
      }),
      {
        path: `/${name}`,
        preMiddleware: [
          deps.authentication({
            verifyFn: verifyFn({ key }),
            cookieKey: key,
            keyClaimsFn,
            audience,
            algorithm,
            strict: protection == "strict",
            allowBasic: basic,
          }),
          ...(protection == "strict"
            ? [
                deps.authorization({
                  permissionsLookupFn,
                  terminatedSessionCheckFn,
                  internalTokenFn,
                  context,
                  permissions:
                    privileges instanceof Array
                      ? privileges.map((privilege) => {
                          return { service, domain, privilege };
                        })
                      : privileges,
                }),
              ]
            : []),
        ],
      }
    );
  }

  server.listen();
};
