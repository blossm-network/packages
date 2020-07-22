const deps = require("./deps");

module.exports = ({
  saveSnapshotFn,
  hashFn,
  aggregateFn,
  rootStreamFn,
  latestBlockFn,
  saveBlockFn,
  public,
}) => async (transaction) => {
  const previousBlock = await latestBlockFn();

  if (!previousBlock)
    throw deps.preconditionFailedError.message("There is no genesis block.");

  const snapshots = [];

  const boundary = deps.dateString();

  await rootStreamFn({
    updatedOnOrAfter: previousBlock.boundary,
    updatedBefore: boundary,
    fn: async ({ root }) => {
      const aggregate = await aggregateFn(root);

      if (aggregate.events.length == 0) return;

      const stringifiedEvents = aggregate.events.map((e) =>
        public ? deps.cononicalString(e) : e.hash
      );
      const previousHash = aggregate.snapshotHash;
      const merkleRoot = deps.merkleRoot({
        data: [...stringifiedEvents, previousHash],
        hashFn,
      });

      const data = {
        hash: merkleRoot,
        ...(previousHash && { previous: previousHash }),
        data: stringifiedEvents,
        public,
        lastEventNumber: aggregate.lastEventNumber,
        root,
        state: aggregate.state,
      };

      const hash = await hashFn(data);

      const normalizedSnapshot = {
        data,
        hash,
      };

      const snapshot = await saveSnapshotFn({
        snapshot: normalizedSnapshot,
        ...(transaction && { transaction }),
      });

      snapshots.push(snapshot);
    },
    parallel: 100,
  });

  const stringifiedSnapshots = snapshots.map((s) => deps.cononicalString(s));
  const merkleRoot = deps.merkleRoot({
    data: [...stringifiedSnapshots, previousBlock.hash],
    hashFn,
  });

  const normalizedBlock = {
    hash: merkleRoot,
    previous: previousBlock.hash,
    data: stringifiedSnapshots,
    number: previousBlock.number + 1,
    boundary,
    network: process.env.NETWORK,
    service: process.env.SERVICE,
    domain: process.env.DOMAIN,
  };

  await saveBlockFn({
    block: normalizedBlock,
    ...(transaction && { transaction }),
  });
};