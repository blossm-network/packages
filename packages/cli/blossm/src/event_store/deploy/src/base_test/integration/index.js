require("localenv");
const crypto = require("crypto");
const { expect } = require("chai").use(require("chai-datetime"));
const request = require("@blossm/request");
const { string: dateString } = require("@blossm/datetime");
const hash = require("@blossm/hash");
const uuid = require("@blossm/uuid");

const {
  domain,
  service,
  testing,
  schema,
  indexes,
} = require("../../config.json");

const url = `http://${process.env.MAIN_CONTAINER_NAME}`;

const {
  subscribe,
  create,
  delete: del,
  unsubscribe,
} = require("@blossm/gcp-pubsub");

const topic = `some-topic.${process.env.DOMAIN}.${process.env.SERVICE}`;
const sub = `a${uuid()}`; //needs to start with a letter
const version = 0;

//TODO test snapshot limit of 100 per block.
describe("Event store integration tests", () => {
  expect(testing.examples.length).to.be.greaterThan(1);
  const example0 = testing.examples[0];
  const example1 = testing.examples[1];

  before(async () => await create(topic));
  after(async () => await del(topic));

  it("should have examples", () => {
    expect(example0).to.exist;
    expect(example1).to.exist;
  });

  it("should return successfully", async () => {
    const root = uuid();
    const now = dateString();

    const countResponse = await request.get(`${url}/count/${root}`);
    const parsedCountBody = JSON.parse(countResponse.body);

    expect(parsedCountBody.count).to.equal(0);

    const genesisBlockResponse = await request.post(`${url}/create-block`);

    expect(genesisBlockResponse.statusCode).to.equal(200);
    const parsedGenesisBlockBody = JSON.parse(genesisBlockResponse.body);
    expect(parsedGenesisBlockBody.hash).to.equal(
      hash(parsedGenesisBlockBody.headers).create()
    );

    const response0 = await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root,
                idempotency: uuid(),
                topic,
                created: now,
                action: example0.action,
                domain,
                service,
                network: process.env.NETWORK,
                version,
              },
              payload: example0.payload,
            },
          },
        ],
      },
    });

    expect(response0.statusCode).to.equal(204);

    const newCountResponse = await request.get(`${url}/count/${root}`);
    const newParsedCountBody = JSON.parse(newCountResponse.body);

    expect(newParsedCountBody.count).to.equal(1);

    const response1 = await request.get(`${url}/${root}`);
    expect(response1.statusCode).to.equal(200);

    const parsedBody1 = JSON.parse(response1.body);
    for (const property in example0.payload) {
      expect(parsedBody1.state[property]).to.deep.equal(
        example0.payload[property]
      );
    }

    const response2 = await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root,
                topic,
                idempotency: uuid(),
                created: dateString(),
                version,
                action: example1.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: example1.payload,
            },
          },
        ],
      },
    });

    expect(response2.statusCode).to.equal(204);

    const response3 = await request.get(`${url}/${root}`);
    expect(response3.statusCode).to.equal(200);

    const parsedBody3 = JSON.parse(response3.body);
    for (const property in example1) {
      expect(parsedBody3.state[property]).to.deep.equal(
        example1.payload[property]
      );
    }

    //Test stream
    let currentNumber = 0;
    await request.stream(`${url}/stream-aggregates`, (data) => {
      const parsedData = JSON.parse(data.toString());
      expect(parsedData.headers.lastEventNumber).to.equal(1);
      currentNumber++;
    });
    expect(currentNumber).to.equal(1);

    //Test root stream
    await request.stream(
      `${url}/roots`,
      (data) => {
        const parsedData = JSON.parse(data.toString());
        expect(parsedData.root).to.equal(root);
      },
      {
        query: {},
      }
    );

    const root2 = uuid();
    await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root: root2,
                topic,
                idempotency: uuid(),
                //Use the previous date
                created: dateString(),
                version,
                action: example1.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: example1.payload,
            },
          },
        ],
      },
    });
    const root3 = uuid();
    //Test stream with actions and root qualifiers
    await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root: root3,
                topic,
                idempotency: uuid(),
                //Use the previous date
                created: now,
                version,
                action: example1.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: example1.payload,
            },
          },
        ],
      },
    });

    let aggregateCount = 0;
    await request.stream(
      `${url}/stream-aggregates`,
      (data) => {
        aggregateCount++;
        const parsedData = JSON.parse(data.toString());
        if (parsedData.headers.root == root) {
          expect(parsedData.headers.lastEventNumber).to.equal(0);
        } else if (parsedData.headers.root == root3) {
          expect(parsedData.headers.lastEventNumber).to.equal(0);
        } else {
          //shouldn't get called
          expect(1).to.equal(2);
        }
      },
      {
        query: {
          timestamp: now,
        },
      }
    );
    expect(aggregateCount).to.equal(2);

    const blockResponse = await request.post(`${url}/create-block`);

    expect(blockResponse.statusCode).to.equal(200);
    const parsedBlockBody = JSON.parse(blockResponse.body);
    expect(parsedBlockBody.hash).to.equal(
      hash(parsedBlockBody.headers).create()
    );
    expect(parsedBlockBody.headers.pHash).to.equal(parsedGenesisBlockBody.hash);
    expect(parsedBlockBody.headers.number).to.equal(1);

    expect(
      crypto
        .createVerify("SHA256")
        .update(parsedBlockBody.hash)
        .verify(
          Buffer.from(parsedBlockBody.headers.key, "base64").toString("utf8"),
          parsedBlockBody.signature,
          "base64"
        )
    ).to.be.true;

    ///Test indexes
    for (const index of indexes || []) {
      const indexParts = index.split(".");
      //order matters since example1 was the last to be added.
      const example = [example1, example0].find((e) => {
        let obj = e.payload;
        for (const part of indexParts) {
          obj = obj[part];
          if (obj == undefined) return false;
        }
        return true;
      });
      let value = example.payload;
      for (const part of indexParts) value = value[part];
      const response4 = await request.get(url, {
        query: {
          key: [index],
          value,
        },
      });
      expect(response4.statusCode).to.equal(200);

      const parsedBody4 = JSON.parse(response4.body);
      for (const key in example1.result || example1) {
        expect(parsedBody4[0].state[key]).to.deep.equal(example1.payload[key]);
      }
    }

    ///Test block limit
    for (let i = 0; i < 120; i++) {
      await request.post(url, {
        body: {
          eventData: [
            {
              event: {
                headers: {
                  root: uuid(),
                  topic,
                  idempotency: uuid(),
                  created: dateString(),
                  version,
                  action: example1.action,
                  domain,
                  service,
                  network: process.env.NETWORK,
                },
                payload: example1.payload,
              },
            },
          ],
        },
      });
    }
    const bigBlockResponse = await request.post(`${url}/create-block`);

    expect(bigBlockResponse.statusCode).to.equal(200);
    const parsedBigBlockBody = JSON.parse(blockResponse.body);
    expect(parsedBigBlockBody.headers.sCount).to.equal(100);
  });
  it("should return successfully adding two events together", async () => {
    const root = uuid();

    const response = await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root,
                topic,
                idempotency: uuid(),
                created: dateString(),
                version,
                action: example0.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: example0.payload,
            },
          },
          {
            event: {
              headers: {
                root,
                topic,
                idempotency: uuid(),
                created: dateString(),
                version,
                action: example1.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: example1.payload,
            },
          },
        ],
      },
    });

    expect(response.statusCode).to.equal(204);
  });

  it("should publish event successfully", (done) => {
    subscribe({
      topic,
      name: sub,
      fn: async (_, subscription) => {
        if (!subscription) throw "Subscription wasn't made";
        const root = uuid();
        subscription.once("message", async () => {
          await unsubscribe({ topic, name: sub });
          done();
        });
        request.post(url, {
          body: {
            eventData: [
              {
                event: {
                  headers: {
                    root,
                    topic,
                    idempotency: uuid(),
                    created: dateString(),
                    version,
                    action: example0.action,
                    domain,
                    service,
                    network: process.env.NETWORK,
                  },
                  payload: example0.payload,
                },
              },
            ],
          },
        });
      },
    });
  });
  const testIncorrectParams = async ({ payload, action }) => {
    const root = uuid();

    const response = await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root,
                topic,
                idempotency: uuid(),
                created: dateString(),
                version,
                action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload,
            },
          },
        ],
      },
    });
    expect(response.statusCode).to.equal(500);
  };
  it("should not return an error if two simultaneous events are attempted", async () => {
    const root = uuid();

    const [response0, response1] = await Promise.all([
      request.post(url, {
        body: {
          eventData: [
            {
              event: {
                headers: {
                  root,
                  topic,
                  idempotency: uuid(),
                  created: dateString(),
                  version,
                  action: example0.action,
                  domain,
                  service,
                  network: process.env.NETWORK,
                },
                payload: example0.payload,
              },
            },
          ],
        },
      }),

      request.post(url, {
        body: {
          eventData: [
            {
              event: {
                headers: {
                  root,
                  topic,
                  idempotency: uuid(),
                  created: dateString(),
                  version,
                  action: example1.action,
                  domain,
                  service,
                  network: process.env.NETWORK,
                },
                payload: example1.payload,
              },
            },
          ],
        },
      }),
    ]);

    expect(response0.statusCode).to.equal(204);
    expect(response1.statusCode).to.equal(204);
  });

  const findBadValue = (schema, property) => {
    return schema[property] == "String" ||
      (typeof schema[property] == "object" &&
        !(schema[property] instanceof Array) &&
        (schema[property]["type"] == "String" ||
          (typeof schema[property]["type"] == "object" &&
            schema[property]["type"]["type"] == "String")))
      ? { a: 1 } //pass an object to a String property
      : "some-string"; // or, pass a string to a non-String property
  };

  const badObjectValue = async (key, schema) => {
    for (const property in schema) {
      const badValue = findBadValue(schema, property);
      await testIncorrectParams({
        payload: {
          ...example0.payload,
          [key]: { [property]: badValue },
        },
        action: example0.action,
      });
    }
    return "bad-object";
  };

  const badArrayValue = async (property, schema) => {
    const element = schema[0];
    const [exampleToUse] = testing.examples.filter(
      (example) => example.payload[property] != undefined
    );

    if (!exampleToUse) return "bad-array";

    await testIncorrectParams({
      payload: {
        ...exampleToUse.payload,
        [property]: "not-an-array",
      },
      action: exampleToUse.action,
    });

    if (typeof element == "object") {
      for (const objProperty in element) {
        //root
        const badValue = findBadValue(element, objProperty);
        await testIncorrectParams({
          payload: {
            ...exampleToUse.payload,
            [property]: [{ [objProperty]: badValue }],
          },
          action: exampleToUse.action,
        });
      }
    } else {
      const badValue = element == "String" ? { a: 1 } : "some-string";
      await testIncorrectParams({
        payload: { ...exampleToUse.payload, [property]: [badValue] },
        action: exampleToUse.action,
      });
    }

    return "bad-array";
  };

  it("should return an error if incorrect params", async () => {
    //Grab a property from the schema and pass a wrong value to it.
    for (const property in schema) {
      if (schema[property] == "Object") continue;
      let badValue;
      if (
        typeof schema[property] == "object" &&
        !(schema[property] instanceof Array) &&
        schema[property]["type"] == undefined
      ) {
        badValue = await badObjectValue(property, schema[property]);
      } else if (schema[property] instanceof Array) {
        badValue = await badArrayValue(property, schema[property]);
      } else {
        badValue = findBadValue(schema, property);
      }

      const [exampleToUse] = testing.examples.filter(
        (example) => example.payload[property] != undefined
      );

      if (!exampleToUse) return;

      await testIncorrectParams({
        payload: { ...exampleToUse.payload, [property]: badValue },
        action: exampleToUse.action,
      });
    }
  });

  it("should return an error if bad number", async () => {
    const root = uuid();

    const response = await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root,
                topic,
                idempotency: uuid(),
                created: dateString(),
                version,
                action: example0.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: example0.payload,
            },
            number: 2,
          },
        ],
      },
    });
    expect(response.statusCode).to.equal(412);
  });
  it("should not return an error if same idempotency, but only one should be saved", async () => {
    const root = uuid();
    const idempotency = uuid();

    const response = await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root,
                topic,
                idempotency,
                created: dateString(),
                version,
                action: example0.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: { ...example0.payload, b: 2 },
            },
          },
          {
            event: {
              headers: {
                root,
                topic,
                idempotency,
                created: dateString(),
                version,
                action: example0.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: { ...example0.payload, a: 1 },
            },
          },
        ],
      },
    });
    expect(response.statusCode).to.equal(204);
    const otherResponse = await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root,
                topic,
                idempotency,
                created: dateString(),
                version,
                action: example0.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: example0.payload,
            },
          },
          {
            event: {
              headers: {
                root,
                topic,
                idempotency,
                created: dateString(),
                version,
                action: example0.action,
                domain,
                service,
                network: process.env.NETWORK,
              },
              payload: example0.payload,
            },
          },
        ],
      },
    });
    expect(otherResponse.statusCode).to.equal(204);
    const countResponse = await request.get(`${url}/count/${root}`);
    const parsedCountBody = JSON.parse(countResponse.body);

    expect(parsedCountBody.count).to.equal(1);
  });
  it("should return an error if action is not recognized", async () => {
    const root = uuid();

    const response = await request.post(url, {
      body: {
        eventData: [
          {
            event: {
              headers: {
                root,
                topic,
                idempotency: uuid(),
                created: dateString(),
                version,
                action: "bogus",
                domain,
                service,
              },
              payload: example0.payload,
            },
          },
        ],
      },
    });

    expect(response.statusCode).to.equal(400);
  });
});
