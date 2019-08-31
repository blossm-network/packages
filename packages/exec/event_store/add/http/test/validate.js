const { expect } = require("chai");
const validate = require("../src/validate");

const goodParams = {
  domain: "some-store-domain",
  service: "some-service",
  event: {
    context: {
      service: "service",
      network: "network"
    },
    fact: {
      root: "someRoot",
      topic: "a.topic",
      version: 0,
      command: {
        id: "someId",
        action: "some-action",
        domain: "some-domain",
        service: "some-service",
        issuedTimestamp: 123
      },
      traceId: "a-trace-id",
      createdTimestamp: 10
    },
    payload: {
      a: 1,
      b: 2
    }
  }
};

describe("Validate add", () => {
  it("should handle correct params correctly", async () => {
    expect(await validate(goodParams)).to.not.throw;
  });
  it("should throw if a bad domain is passed", async () => {
    const params = {
      ...goodParams,
      domain: ""
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no domain is passed", async () => {
    const params = {
      ...goodParams,
      domain: undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad service is passed", async () => {
    const params = {
      ...goodParams,
      service: ""
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no service is passed", async () => {
    const params = {
      ...goodParams,
      service: undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad event is passed", async () => {
    const params = {
      ...goodParams,
      event: 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no event is passed", async () => {
    const params = {
      ...goodParams,
      event: undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad payload is passed", async () => {
    const params = {
      ...goodParams,
      "event.payload": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no payload is passed", async () => {
    const params = {
      ...goodParams,
      "event.payload": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad context is passed", async () => {
    const params = {
      ...goodParams,
      "event.context": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no context is passed", async () => {
    const params = {
      ...goodParams,
      "event.context": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad fact is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no fact is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad root passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.root": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no root is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.root": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad topic is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.topic": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no topic is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.topic": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad version is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.version": {}
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no version is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.version": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad command is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no command is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad command id is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.id": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no command id is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.id": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad command action is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.action": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no command action is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.action": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad command domain is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.domain": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no command domain is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.domain": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad command service is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.service": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no command service is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.service": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad command issued timestamp is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.issuedTimestamp": "Asdf"
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no command issued timestamp is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.command.issuedTimestamp": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if a bad trace id is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.traceId": 123
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should not throw if no traceId is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.traceId": undefined
    };

    expect(async () => await validate(params)).to.not.throw;
  });
  it("should throw if a bad created timestamp is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.createdTimestamp": "nope"
    };

    expect(async () => await validate(params)).to.throw;
  });
  it("should throw if no created timestamp is passed", async () => {
    const params = {
      ...goodParams,
      "event.fact.createdTimestamp": undefined
    };

    expect(async () => await validate(params)).to.throw;
  });
});
