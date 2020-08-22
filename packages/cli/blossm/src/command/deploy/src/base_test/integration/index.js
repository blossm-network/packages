require("localenv");
const { expect } = require("chai");
const { string: dateString } = require("@blossm/datetime");
const uuid = require("@blossm/uuid");
const eventStore = require("@blossm/event-store-rpc");
const createEvent = require("@blossm/create-event");
const { hash } = require("@blossm/crypt");

const request = require("@blossm/request");

const url = `http://${process.env.MAIN_CONTAINER_NAME}`;

const { testing, contexts } = require("../../config.json");

const checkResponse = ({ data, expected }) => {
  for (const property in expected) {
    expect(data[property]).to.exist;
    if (expected[property]) {
      if (
        typeof expected[property] == "object" &&
        !(expected[property] instanceof Array)
      ) {
        checkResponse({
          data: data[property],
          expected: expected[property],
        });
      } else if (expected[property] instanceof Array) {
        expect(data[property]).to.be.an("array");
        let i = 0;
        for (const expectedValue of expected[property]) {
          checkResponse({
            data: data[property][i],
            expected: expectedValue[i],
          });
          i++;
        }
      } else {
        expect(data[property]).to.deep.equal(expected[property]);
      }
    }
  }
};

const formattedPayload = async (payload) => {
  let result = {};
  for (const property in payload) {
    if (
      typeof payload[property] == "object" &&
      !(payload[property] instanceof Array)
    ) {
      result[property] = await formattedPayload(payload[property]);
    } else if (
      typeof payload[property] == "string" &&
      payload[property].startsWith("#")
    ) {
      result[property] = await hash(
        payload[property].substring(payload[property].indexOf("#") + 1)
      );
    } else {
      result[property] = payload[property];
    }
  }

  return result;
};
const executeStep = async (step) => {
  if (step.pre) {
    for (const {
      action,
      domain,
      service,
      root,
      payload = {},
      groupsAdded,
    } of step.pre) {
      const stateEvent = createEvent({
        root,
        payload: await formattedPayload(payload),
        action,
        domain,
        service,
        network: process.env.NETWORK,
        groupsAdded,
      });

      await eventStore({ domain, service }).add({
        eventData: [{ event: stateEvent }],
      });
    }
  }

  const necessaryContext = {};
  if (contexts) {
    for (const c of contexts) {
      necessaryContext[c] = "something";
    }
  }

  const response = await request.post(url, {
    body: {
      root: step.root,
      headers: {
        //In non-test environments, the command issuer sets the issued date.
        issued: dateString(),
        accepted: dateString(),
        //In non-test environments, a gateway adds an id.
        id: uuid(),
      },
      options: step.options,
      context: {
        ...necessaryContext,
        ...step.context,
      },
      tx: {
        ip: step.ip,
      },
      payload: step.payload,
      claims: step.claims,
    },
  });

  if (response.statusCode != step.code) {
    //eslint-disable-next-line no-console
    console.log("response: ", response);
  }

  expect(response.statusCode).to.equal(step.code);

  if (!step.response) return;

  const parsedBody = JSON.parse(response.body);

  checkResponse({
    expected: step.response,
    data: parsedBody,
  });
};

describe("Command handler integration tests", () => {
  it("should return successfully", async () => {
    if (contexts) {
      const response = await request.post(url, {
        body: {
          context: {},
        },
      });

      expect(response.statusCode).to.equal(403);
    }

    let i = 0;
    for (const step of testing.steps) {
      //eslint-disable-next-line no-console
      console.log("Executing step ", i++);
      await executeStep(step);
    }
  });

  it("should return an error if incorrect params", async () => {
    if (!testing.validate || !testing.validate.bad || !testing.validate.bad[0])
      return;

    const necessaryContext = {};
    if (contexts) {
      for (const c of contexts) {
        necessaryContext[c] = "something";
      }
    }
    const response = await request.post(url, {
      body: {
        headers: {
          issued: dateString(),
          accepted: dateString(),
          id: uuid(),
        },
        payload: createBadPayload({
          bad: testing.validate.bad[0],
          ok: testing.validate.ok[0],
        }),
        context: necessaryContext,
        claims: {
          iss: "some-iss",
          aud: "some-aud",
        },
      },
    });

    expect(response.statusCode).to.equal(409);
  });
});

const createBadPayload = ({ bad, ok }) => {
  let payload = { ...bad };

  for (const property in ok) {
    payload[property] =
      bad[property] != undefined
        ? typeof ok[property] == "object" &&
          !(ok[property] instanceof Array) &&
          typeof bad[property] == "object" &&
          !(bad[property] instanceof Array)
          ? createBadPayload({
              bad: bad[property],
              ok: ok[property],
            })
          : (payload[property] = bad[property])
        : (payload[property] = ok[property]);
  }

  return payload;
};
