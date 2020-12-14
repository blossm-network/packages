const deps = require("./deps");

const common = async ({ method, url, params, headers, onDataFn = () => {} }) =>
  new Promise((resolve, reject) =>
    deps
      .request(
        {
          url: url.startsWith("http")
            ? url
            : `${process.env.NODE_ENV == "local" ? "http" : "https"}://${url}`,
          method,
          ...(params != undefined && { json: params }),
          ...(headers != undefined && { headers }),
        },
        (err, response, body) =>
          err
            ? reject(err)
            : resolve({
                headers: response.headers,
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                body,
              })
      )
      .on("response", () => console.log("YES FINALLY!"))
      .on("data", onDataFn)
  );

const jointStream = (streams, sortFn) => {
  switch (streams.length) {
    case 1:
      return streams[0];
    case 2:
      return new deps.union(streams[0], streams[1], sortFn);
    default: {
      const half = Math.ceil(streams.length / 2);
      const firstHalf = streams.splice(0, half);
      const secondHalf = streams.splice(-half);
      return new deps.union(
        jointStream(firstHalf, sortFn),
        jointStream(secondHalf, sortFn),
        sortFn
      );
    }
  }
};

exports.post = async (url, { body, headers } = {}) =>
  await common({ method: "POST", url, params: body, headers });

exports.put = async (url, { body, headers } = {}) =>
  await common({ method: "PUT", url, params: body, headers });

exports.delete = async (url, { query, headers } = {}) =>
  await common({
    method: "DELETE",
    url: deps.urlEncodeQueryData(url, query),
    headers,
  });

exports.get = async (url, { query, headers, onDataFn } = {}) =>
  await common({
    method: "GET",
    url: deps.urlEncodeQueryData(url, query),
    headers,
    onDataFn,
  });

exports.stream = async (url, onDataFn, { query, headers } = {}) => {
  let ended = false;
  let rejected = false;
  let processingCount = 0;

  return new Promise((resolve, reject) => {
    const processData = async (data) => {
      try {
        processingCount++;
        await onDataFn(data);
        processingCount--;
      } catch (err) {
        if (err) {
          reject(err);
          rejected = true;
        }
      }
      if (!rejected && processingCount == 0 && ended) resolve();
    };

    return deps
      .request({
        url: deps.urlEncodeQueryData(url, query),
        method: "GET",
        ...(headers != undefined && { headers }),
      })
      .on("data", (data) => processData(data))
      .on("error", (err) => {
        if (rejected) return;
        rejected = true;
        reject(err);
      })
      .on("end", () => {
        ended = true;
        if (!rejected && processingCount == 0) resolve();
      });
  });
};

exports.streamMany = async (requests, onDataFn, sortFn) => {
  const requestStreams = requests.map(({ url, query, headers }) =>
    deps.request({
      url: deps.urlEncodeQueryData(url, query),
      method: "GET",
      ...(headers != undefined && { headers }),
    })
  );

  let ended = false;
  let rejected = false;
  let processingCount = 0;

  return new Promise((resolve, reject) => {
    const processData = async (data) => {
      try {
        processingCount++;
        await onDataFn(data);
        processingCount--;
      } catch (err) {
        if (err) {
          reject(err);
          rejected = true;
        }
      }
      if (!rejected && processingCount == 0 && ended) resolve();
    };

    return jointStream(requestStreams, sortFn)
      .on("data", (data) => processData(data))
      .on("error", (err) => {
        if (rejected) return;
        rejected = true;
        reject(err);
      })
      .on("end", () => {
        ended = true;
        if (!rejected && processingCount == 0) resolve();
      });
  });
};
