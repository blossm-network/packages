const { expect } = require("chai").use(require("sinon-chai"));
const { replace, restore, fake, stub } = require("sinon");

const main = require("../../main");
const deps = require("../../deps");

const payloadNetwork = "some-payload-network";
const payload = { network: payloadNetwork };
const identity = "some-identity";
const context = { identity };
const claims = {
  a: 1
};

const domain = "some-domain";
const service = "some-service";
const network = "some-network";

process.env.DOMAIN = domain;
process.env.SERVICE = service;
process.env.NETWORK = network;

describe("Command handler unit tests", () => {
  afterEach(() => {
    restore();
  });
  it("should return successfully", async () => {
    const nodeRoot = "some-node-root";
    const sceneRoot = "some-scene-root";

    const uuidFake = stub()
      .onFirstCall()
      .returns(nodeRoot)
      .onSecondCall()
      .returns(sceneRoot);

    replace(deps, "uuid", uuidFake);

    const tokens = "some-tokens";
    const principleRoot = "some-principle-root";
    const principleService = "some-principle-service";
    const principleNetwork = "some-principle-network";

    const issueFake = fake.returns({
      tokens,
      principle: {
        root: principleRoot,
        service: principleService,
        network: principleNetwork
      }
    });
    const setFake = fake.returns({
      issue: issueFake
    });
    const commandFake = fake.returns({
      set: setFake
    });
    replace(deps, "command", commandFake);

    const result = await main({ payload, context, claims });
    expect(result).to.deep.equal({
      events: [
        {
          domain: "principle",
          service: principleService,
          network: principleNetwork,
          action: "add-roles",
          root: principleRoot,
          payload: {
            roles: [{ id: "NodeAdmin", service, network }]
          }
        },
        {
          action: "register",
          root: nodeRoot,
          payload: {
            network: payloadNetwork,
            scene: { root: sceneRoot, service, network }
          }
        }
      ],
      response: { tokens, roots: { node: nodeRoot, scene: sceneRoot } }
    });
    expect(commandFake).to.have.been.calledWith({
      name: "register",
      domain: "scene"
    });
    expect(setFake).to.have.been.calledWith({
      context,
      claims,
      tokenFn: deps.gcpToken
    });
    expect(issueFake).to.have.been.calledWith(
      {
        root: nodeRoot,
        domain,
        service,
        network
      },
      { root: sceneRoot }
    );
  });
  it("should throw correctly", async () => {
    const errorMessage = "some-error";
    const uuidFake = fake.throws(errorMessage);
    replace(deps, "uuid", uuidFake);
    try {
      await main({});
      //shouldn't get called
      expect(2).to.equal(3);
    } catch (e) {
      expect(e.message).to.equal(errorMessage);
    }
  });
});
