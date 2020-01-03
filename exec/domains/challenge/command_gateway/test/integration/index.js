require("localenv");
const { expect } = require("chai");
const { string: stringDate } = require("@blossm/datetime");
const getToken = require("@blossm/get-token");
const { create, delete: del } = require("@blossm/gcp-pubsub");

const request = require("@blossm/request");

const url = `http://${process.env.MAIN_CONTAINER_NAME}`;

const config = require("./../../config.json");

describe("Command gateway integration tests", () => {
  before(async () => await Promise.all(config.topics.map(t => create(t))));
  after(async () => await Promise.all(config.topics.map(t => del(t))));

  it("should return successfully", async () => {
    const issueFn = async ({ phone }) => {
      const response = await request.post(`${url}/issue`, {
        body: {
          headers: {
            issued: stringDate()
          },
          payload: {
            phone
          }
        }
      });

      expect(response.statusCode).to.equal(200);
      const { token, root } = JSON.parse(response.body);
      return { token, root };
    };
    const answerFn = async ({ code, root, token }) => {
      const response = await request.post(`${url}/answer`, {
        body: {
          root,
          headers: {
            issued: stringDate()
          },
          payload: {
            code
          }
        },
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      expect(response.statusCode).to.equal(200);
      const { token: newToken } = JSON.parse(response.body);

      return { root, token: newToken };
    };

    const { token, root } = await getToken({
      issueFn,
      answerFn
    });

    expect(root).to.exist;
    expect(token).to.exist;
  });
});
