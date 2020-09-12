const deps = require("./deps");

module.exports = async ({
  facts,
  domain = process.env.DOMAIN,
  service = process.env.SERVICE,
  whitelist,
  permissionsLookupFn,
  terminatedSessionCheckFn,
  deletedSceneCheckFn,
  verifyFn,
  internalTokenFn,
  nodeExternalTokenFn,
  algorithm,
  audience,
}) => {
  let server = deps.server({
    prehook: (app) =>
      deps.corsMiddleware({
        app,
        whitelist,
        credentials: true,
        methods: ["GET"],
      }),
  });

  for (const {
    name,
    key = "access",
    privileges,
    protection = "strict",
    context,
  } of facts) {
    server = server.get(
      deps.get({
        name,
        domain,
        internalTokenFn,
        nodeExternalTokenFn,
        key,
      }),
      {
        path: `/${name}`,
        ...(protection != "none" && {
          preMiddleware: [
            deps.authentication({
              verifyFn: verifyFn({ key }),
              audience,
              algorithm,
              protection,
              cookieKey: key,
            }),
            ...(protection == "strict"
              ? [
                  deps.authorization({
                    permissionsLookupFn,
                    terminatedSessionCheckFn,
                    deletedSceneCheckFn,
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
        }),
      }
    );
  }

  server.listen();
};
