const { expect } = require("chai")
  .use(require("chai-datetime"))
  .use(require("sinon-chai"));
const { restore, useFakeTimers } = require("sinon");

const main = require("../../main");

let clock;
const now = new Date();

describe("Event handler unit tests", () => {
  beforeEach(() => {
    clock = useFakeTimers(now.getTime());
  });
  afterEach(() => {
    clock.restore();
    restore();
  });
  it("should return successfully", async () => {
    const name = "some-name";
    const identity = "some-identity";
    const payload = { name };
    const context = { identity };
    const headers = { context };

    const response = await main({ payload, headers });

    expect(response).to.deep.equal({
      name,
      identity
    });
  });
});
