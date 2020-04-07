const { expect } = require("chai").use(require("sinon-chai"));
const { restore, fake, replace } = require("sinon");
const deps = require("../deps");
const connectionToken = require("..");

const coreNetwork = "some-core-network";
const token = "some-token";
const id = "some-credentials-id";
const secret = "some-credentials-secret";
const exp = "9999-01-03T00:02:12.000Z";
const expiredExp = "2000-01-03T00:02:12.000Z";
const network = "some-network";
const basicToken = "some-basic-token";

const currentNetwork = "some-current-network";
process.env.NETWORK = currentNetwork;

describe("Connection token", () => {
  afterEach(() => {
    restore();
  });
  it("should call correctly", async () => {
    const response = {
      tokens: [{ network: currentNetwork, value: token }]
    };

    const issueFake = fake.returns(response);
    const setFake = fake.returns({
      issue: issueFake
    });
    const commandFake = fake.returns({
      set: setFake
    });
    replace(deps, "command", commandFake);

    const validateFake = fake.returns({ exp });
    replace(deps, "validate", validateFake);

    const basicTokenFake = fake.returns(basicToken);
    replace(deps, "basicToken", basicTokenFake);

    const credentialsFnFake = fake.returns({ id, secret });
    const result = await connectionToken({
      coreNetwork,
      credentialsFn: credentialsFnFake
    })({ network });

    expect(commandFake).to.have.been.calledWith({
      name: "open",
      domain: "connection",
      service: "system",
      network: coreNetwork
    });
    expect(setFake).to.have.been.calledWith({
      tokenFns: { external: basicToken }
    });
    expect(basicTokenFake).to.have.been.calledWith({
      id,
      secret
    });
    expect(issueFake).to.have.been.calledWith();
    expect(credentialsFnFake).to.have.been.calledWith({ network });
    expect(result).to.equal(token);

    const anotherResult = await connectionToken({
      coreNetwork,
      credentialsFn: credentialsFnFake
    })({ network });
    expect(commandFake).to.have.been.calledOnce;
    expect(anotherResult).to.equal(token);
  });
  it("should call correctly if expired", async () => {
    const response = {
      tokens: [{ network: currentNetwork, value: token }]
    };

    const issueFake = fake.returns(response);
    const setFake = fake.returns({
      issue: issueFake
    });
    const commandFake = fake.returns({
      set: setFake
    });
    replace(deps, "command", commandFake);

    const validateFake = fake.returns({ exp: expiredExp });
    replace(deps, "validate", validateFake);

    const basicTokenFake = fake.returns(basicToken);
    replace(deps, "basicToken", basicTokenFake);
    const anotherNetwork = "another-network";
    const credentialsFnFake = fake.returns({ id, secret });
    const result = await connectionToken({
      coreNetwork,
      credentialsFn: credentialsFnFake
    })({ network: anotherNetwork });
    expect(result).to.equal(token);

    const anotherResult = await connectionToken({
      coreNetwork,
      credentialsFn: credentialsFnFake
    })({ network: anotherNetwork });
    expect(commandFake).to.have.been.calledTwice;
    expect(anotherResult).to.equal(token);
  });
});
