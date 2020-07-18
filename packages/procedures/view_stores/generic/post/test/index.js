const { expect } = require("chai")
  .use(require("chai-datetime"))
  .use(require("sinon-chai"));

const { restore, replace, fake, useFakeTimers } = require("sinon");

const put = require("..");
const deps = require("../deps");

let clock;

const now = new Date();

const writeResult = "some-write-result";
const query = "query";
const body = {
  update: {
    body: {
      a: 1,
    },
    trace: 2,
    context: 3,
  },
  query,
};

describe("View store put", () => {
  beforeEach(() => {
    clock = useFakeTimers(now.getTime());
  });
  afterEach(() => {
    clock.restore();
    restore();
  });

  it("should call with the correct params", async () => {
    const writeFake = fake.returns(writeResult);

    const req = {
      body,
    };

    const sendFake = fake();
    const statusFake = fake.returns({
      send: sendFake,
    });
    const res = {
      status: statusFake,
    };

    await put({ writeFn: writeFake })(req, res);

    expect(writeFake).to.have.been.calledWith({
      query,
      data: {
        "body.a": 1,
        "headers.trace": 2,
        "headers.context": 3,
        "headers.modified": deps.dateString(),
      },
    });
    expect(statusFake).to.have.been.calledWith(200);
    expect(sendFake).to.have.been.calledWith(writeResult);
  });

  it("should call with the correct params with custom fn", async () => {
    const writeFake = fake.returns(writeResult);

    const req = {
      body,
    };

    const sendFake = fake();
    const statusFake = fake.returns({
      send: sendFake,
    });
    const res = {
      status: statusFake,
    };

    const fnFake = fake.returns({ body: { c: 3 }, headers: { b: 2 } });
    await put({ writeFn: writeFake, updateFn: fnFake })(req, res);

    expect(writeFake).to.have.been.calledWith({
      query,
      data: {
        "body.c": 3,
        "headers.modified": deps.dateString(),
      },
    });
    expect(fnFake).to.have.been.calledWith({
      body: { a: 1 },
      trace: 2,
      context: 3,
    });
    expect(statusFake).to.have.been.calledWith(200);
    expect(sendFake).to.have.been.calledWith(writeResult);
  });
  it("should throw if root is missing", async () => {
    const writeFake = fake();

    const req = {
      body: {},
    };

    const sendFake = fake();
    const statusFake = fake.returns({
      send: sendFake,
    });
    const res = {
      status: statusFake,
    };

    const error = "some-error";
    const messageFake = fake.returns(error);
    replace(deps, "badRequestError", {
      message: messageFake,
    });

    const fnFake = fake.returns({ $set: { b: 2 } });

    try {
      await put({ writeFn: writeFake, fn: fnFake })(req, res);

      //shouldn't get called
      expect(1).to.equal(0);
    } catch (e) {
      expect(messageFake).to.have.been.calledWith(
        "Missing query parameter in the body."
      );
      expect(e).to.equal(error);
    }
  });
});