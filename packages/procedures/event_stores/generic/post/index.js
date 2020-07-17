const deps = require("./deps");

module.exports = ({
  saveEventsFn,
  reserveRootCountsFn,
  publishFn,
  hashFn,
  proofsFn,
  saveProofsFn,
  scheduleUpdateForProofFn,
  createTransactionFn,
  idempotencyConflictCheckFn,
}) => async (req, res) => {
  const uniqueEvents = [];
  await Promise.all(
    req.body.events.map(async (event) => {
      if (event.data.headers.idempotency != undefined) {
        const conflict = await idempotencyConflictCheckFn(
          event.data.headers.idempotency
        );

        //If theres no idempotency conflict in the database and no local conflict, proceed.
        if (
          conflict ||
          uniqueEvents.some(
            (uniqueEvent) =>
              uniqueEvent.data.headers.idempotency ==
              event.data.headers.idempotency
          )
        )
          return;
      }
      uniqueEvents.push(event);
    })
  );

  const { events, proofs } = await createTransactionFn(
    deps.postTransaction({
      events: uniqueEvents,
      saveEventsFn,
      reserveRootCountsFn,
      hashFn,
      proofsFn,
      saveProofsFn,
    })
  );

  //No need to publish to the same topic twice.
  let publishedTopics = [];
  await Promise.all([
    ...events.map((e) => {
      if (publishedTopics.includes(e.data.headers.topic)) return;
      publishFn(
        {
          from: e.data.saved,
        },
        e.data.headers.topic
      );
      publishedTopics.push(e.data.headers.topic);
    }),
    ...proofs.map((proof) => scheduleUpdateForProofFn(proof.id)),
  ]);

  res.sendStatus(204);
};
