const { expect } = require("chai")
  .use(require("chai-datetime"))
  .use(require("sinon-chai"));
const { restore, replace, fake, useFakeTimers } = require("sinon");

const main = require("../../main");
const deps = require("../../deps");

let clock;
const now = new Date();
const root = "some-root";
const principleRoot = "some-identity-principle";
const principleService = "some-priciple-service";
const principleNetwork = "some-priciple-network";
const identityRoot = "some-identity-root";
const phone = "some-identity-phone";
const identity = {
  headers: {
    root: identityRoot
  },
  state: {
    principle: {
      root: principleRoot,
      service: principleService,
      network: principleNetwork
    },
    phone
  }
};

const payloadPhone = "some-payload-phone";
const id = "some-id";
const payload = {
  phone: payloadPhone,
  id
};
const context = { a: 1 };
const service = "some-service";
const network = "some-network";
const token = "some-token";
const code = "some-code";
const secret = "some-secret";
const project = "some-projectl";
const claims = {
  iss: "some-iss"
};

process.env.SERVICE = service;
process.env.NETWORK = network;
process.env.GCP_PROJECT = project;

describe("Command handler unit tests", () => {
  beforeEach(() => {
    clock = useFakeTimers(now.getTime());
  });
  afterEach(() => {
    clock.restore();
    restore();
  });
  it("should return successfully", async () => {
    const secretFake = fake.returns(secret);
    replace(deps, "secret", secretFake);

    const smsSendFake = fake();
    const smsFake = fake.returns({
      send: smsSendFake
    });
    replace(deps, "sms", smsFake);

    const uuidFake = fake.returns(root);
    replace(deps, "uuid", uuidFake);

    const compareFake = fake.returns(true);
    replace(deps, "compare", compareFake);

    const queryFake = fake.returns([identity]);
    const setFake = fake.returns({
      query: queryFake
    });
    const eventStoreFake = fake.returns({
      set: setFake
    });
    replace(deps, "eventStore", eventStoreFake);

    const signature = "some-signature";
    const signFake = fake.returns(signature);
    replace(deps, "sign", signFake);

    const createJwtFake = fake.returns(token);
    replace(deps, "createJwt", createJwtFake);

    const randomIntFake = fake.returns(code);
    replace(deps, "randomIntOfLength", randomIntFake);

    const result = await main({ payload, context, claims });

    expect(result).to.deep.equal({
      events: [
        {
          action: "issue",
          root,
          correctNumber: 0,
          payload: {
            code,
            principle: {
              root: principleRoot,
              service: principleService,
              network: principleNetwork
            },
            claims,
            issued: new Date().toISOString(),
            expires: deps
              .moment()
              .add(180, "s")
              .toDate()
              .toISOString()
          }
        }
      ],
      response: {
        tokens: [{ network, type: "challenge", value: token }]
      }
    });
    expect(compareFake).to.have.been.calledWith(payloadPhone, phone);
    expect(queryFake).to.have.been.calledWith({
      key: "id",
      value: id
    });
    expect(secretFake).to.have.been.calledWith("twilio-account-sid");
    expect(secretFake).to.have.been.calledWith("twilio-auth-token");
    expect(smsFake).to.have.been.calledWith(secret, secret);
    expect(setFake).to.have.been.calledWith({
      context,
      tokenFn: deps.gcpToken
    });
    expect(eventStoreFake).to.have.been.calledWith({
      domain: "identity"
    });
    expect(signFake).to.have.been.calledWith({
      ring: "jwt",
      key: "challenge",
      location: "global",
      version: "1",
      project
    });
    expect(createJwtFake).to.have.been.calledWith({
      options: {
        issuer: `challenge.${service}.${network}/issue`,
        audience: `challenge.${service}.${network}/answer`,
        expiresIn: 3600000
      },
      payload: {
        context: {
          ...context,
          challenge: { root, service, network }
        }
      },
      signFn: signature
    });
    expect(randomIntFake).to.have.been.calledWith(6);
    expect(
      Math.abs(
        deps
          .moment()
          .add(3, "m")
          .toDate() - new Date()
      )
    ).to.equal(180000);
    expect(smsSendFake).to.have.been.calledWith({
      to: payloadPhone,
      from: "+14157700262",
      body: `${code} is your verification code. Enter it in the app to let us know it's really you.`
    });
  });
  it("should return successfully if identity is passed in as an option", async () => {
    const secretFake = fake.returns(secret);
    replace(deps, "secret", secretFake);

    const smsSendFake = fake();
    const smsFake = fake.returns({
      send: smsSendFake
    });
    replace(deps, "sms", smsFake);

    const uuidFake = fake.returns(root);
    replace(deps, "uuid", uuidFake);

    const signature = "some-signature";
    const signFake = fake.returns(signature);
    replace(deps, "sign", signFake);

    const createJwtFake = fake.returns(token);
    replace(deps, "createJwt", createJwtFake);

    const randomIntFake = fake.returns(code);
    replace(deps, "randomIntOfLength", randomIntFake);

    const optionsPrinciple = {
      root: principleRoot,
      service: principleService,
      network: principleNetwork
    };

    const compareFake = fake.returns(true);
    replace(deps, "compare", compareFake);

    const result = await main({
      payload,
      context,
      claims,
      options: {
        principle: optionsPrinciple
      }
    });

    expect(compareFake).to.not.have.been.called;
    expect(result).to.deep.equal({
      events: [
        {
          action: "issue",
          root,
          correctNumber: 0,
          payload: {
            code,
            principle: optionsPrinciple,
            claims,
            issued: new Date().toISOString(),
            expires: deps
              .moment()
              .add(180, "s")
              .toDate()
              .toISOString()
          }
        }
      ],
      response: { tokens: [{ network, type: "challenge", value: token }] }
    });
    expect(signFake).to.have.been.calledWith({
      ring: "jwt",
      key: "challenge",
      location: "global",
      version: "1",
      project
    });
    expect(createJwtFake).to.have.been.calledWith({
      options: {
        issuer: `challenge.${service}.${network}/issue`,
        audience: `challenge.${service}.${network}/answer`,
        expiresIn: 3600000
      },
      payload: {
        context: {
          ...context,
          challenge: { root, service, network }
        }
      },
      signFn: signature
    });
    expect(randomIntFake).to.have.been.calledWith(6);
    expect(
      Math.abs(
        deps
          .moment()
          .add(3, "m")
          .toDate() - new Date()
      )
    ).to.equal(180000);
  });
  it("should throw correctly", async () => {
    const errorMessage = "some-error";
    const queryFake = fake.rejects(new Error(errorMessage));
    const setFake = fake.returns({
      query: queryFake
    });
    const eventStoreFake = fake.returns({
      set: setFake
    });
    replace(deps, "eventStore", eventStoreFake);

    try {
      await main({ payload, context, claims });

      //shouldn't get called
      expect(2).to.equal(3);
    } catch (e) {
      expect(e.message).to.equal(errorMessage);
    }
  });
  it("should throw correctly if no phones found", async () => {
    const queryFake = fake.returns([]);
    const setFake = fake.returns({
      query: queryFake
    });
    const eventStoreFake = fake.returns({
      set: setFake
    });
    replace(deps, "eventStore", eventStoreFake);

    const error = "some-error";
    replace(deps, "invalidArgumentError", {
      phoneNotRecognized: fake.returns(error)
    });

    try {
      await main({
        payload,
        claims,
        context
      });

      //shouldn't get called
      expect(2).to.equal(3);
    } catch (e) {
      expect(e).to.equal(error);
    }
  });
  it("should throw correctly if phone number comparing fails.", async () => {
    const secretFake = fake.returns(secret);
    replace(deps, "secret", secretFake);

    const smsSendFake = fake();
    const smsFake = fake.returns({
      send: smsSendFake
    });
    replace(deps, "sms", smsFake);

    const uuidFake = fake.returns(root);
    replace(deps, "uuid", uuidFake);

    const queryFake = fake.returns([identity]);
    const setFake = fake.returns({
      query: queryFake
    });
    const eventStoreFake = fake.returns({
      set: setFake
    });
    replace(deps, "eventStore", eventStoreFake);

    const compareFake = fake.returns(false);
    replace(deps, "compare", compareFake);

    const error = "some-error";
    const messageFake = fake.returns(error);
    replace(deps, "badRequestError", {
      message: messageFake
    });
    try {
      await main({
        payload,
        context
      });

      //shouldn't get called
      expect(2).to.equal(3);
    } catch (e) {
      expect(messageFake).to.have.been.calledWith(
        "This phone number can't be used to challenge."
      );
      expect(e).to.equal(error);
    }
  });
  it("should throw correctly if claims.sub doesn't match the identity's principle", async () => {
    const secretFake = fake.returns(secret);
    replace(deps, "secret", secretFake);

    const smsSendFake = fake();
    const smsFake = fake.returns({
      send: smsSendFake
    });
    replace(deps, "sms", smsFake);

    const uuidFake = fake.returns(root);
    replace(deps, "uuid", uuidFake);

    const queryFake = fake.returns([identity]);
    const setFake = fake.returns({
      query: queryFake
    });
    const eventStoreFake = fake.returns({
      set: setFake
    });
    replace(deps, "eventStore", eventStoreFake);

    const compareFake = fake.returns(true);
    replace(deps, "compare", compareFake);

    const error = "some-error";
    const messageFake = fake.returns(error);
    replace(deps, "badRequestError", {
      message: messageFake
    });
    try {
      await main({
        payload,
        context,
        claims: { sub: "some-bogus" }
      });

      //shouldn't get called
      expect(2).to.equal(3);
    } catch (e) {
      expect(messageFake).to.have.been.calledWith(
        "This principle can't be challenged during the current session."
      );
      expect(e).to.equal(error);
    }
  });
  it("should return successfully with context events", async () => {
    const secretFake = fake.returns(secret);
    replace(deps, "secret", secretFake);

    const smsSendFake = fake();
    const smsFake = fake.returns({
      send: smsSendFake
    });
    replace(deps, "sms", smsFake);

    const uuidFake = fake.returns(root);
    replace(deps, "uuid", uuidFake);

    const queryFake = fake.returns([identity]);
    const setFake = fake.returns({
      query: queryFake
    });
    const eventStoreFake = fake.returns({
      set: setFake
    });
    replace(deps, "eventStore", eventStoreFake);

    const signature = "some-signature";
    const signFake = fake.returns(signature);
    replace(deps, "sign", signFake);

    const createJwtFake = fake.returns(token);
    replace(deps, "createJwt", createJwtFake);

    const randomIntFake = fake.returns(code);
    replace(deps, "randomIntOfLength", randomIntFake);

    const compareFake = fake.returns(true);
    replace(deps, "compare", compareFake);

    const options = { events: [{ a: 1 }, { b: 2 }] };
    const context = { c: 3 };
    const result = await main({
      payload,
      claims,
      context,
      options
    });

    expect(result).to.deep.equal({
      response: { tokens: [{ network, type: "challenge", value: token }] },
      events: [
        {
          action: "issue",
          root,
          correctNumber: 0,
          payload: {
            code,
            principle: {
              root: principleRoot,
              service: principleService,
              network: principleNetwork
            },
            issued: new Date().toISOString(),
            claims,
            expires: deps
              .moment()
              .add(180, "s")
              .toDate()
              .toISOString(),
            events: [
              {
                a: 1
              },
              {
                b: 2
              }
            ]
          }
        }
      ]
    });
    expect(createJwtFake).to.have.been.calledWith({
      options: {
        issuer: `challenge.${service}.${network}/issue`,
        audience: `challenge.${service}.${network}/answer`,
        expiresIn: 3600000
      },
      payload: {
        context: {
          c: 3,
          challenge: { root, service, network }
        }
      },
      signFn: signature
    });
  });
});
