const rootDir = require("@blossm/cli-root-dir");
const path = require("path");
const fs = require("fs");
const yaml = require("yaml");

const procedureIsConfig = (procedure, config) => {
  if (config.context != procedure.context) return false;
  for (const property in procedure) {
    if (config[property] != procedure[property]) return false;
  }
  return true;
};

const objectsEqual = (obj0, obj1) => {
  for (const property in obj0) {
    if (obj1[property] != obj0[property]) return false;
  }
  return true;
};

const eventsForCommandHandler = config =>
  config.testing.events || [
    {
      action: config.action,
      domain: config.domain,
      service: config.service
    }
  ];

const findProceduresAndEventsForProcedure = (procedure, dir) => {
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);

    if (file == "blossm.yaml" || file == "blossm.yml") {
      const blossmConfig = yaml.parse(fs.readFileSync(filePath, "utf8"));

      //If the domain is not the same, the procedure wont be in this directory.
      if (blossmConfig.domain != procedure.domain)
        return { procedures: [], events: [] };
      if (procedureIsConfig(procedure, blossmConfig)) {
        if (blossmConfig.context == "command-handler") {
          //eslint-disable-next-line
          console.log("this is it: ", blossmConfig);
        }
        return {
          procedures: blossmConfig.testing.procedures || [],
          events:
            blossmConfig.context == "command-handler"
              ? eventsForCommandHandler(blossmConfig)
              : []
        };
      }
    } else if (fs.statSync(filePath).isDirectory()) {
      const { procedures, events } = findProceduresAndEventsForProcedure(
        procedure,
        filePath
      );
      if (procedures.length > 0 || events.length > 0)
        return { procedures, events };
    }
  }

  return { procedures: [], events: [] };
};

const findProceduresAndEvents = (procedures, dir, allProcedures, allEvents) => {
  const newProcedures = [];
  const newEvents = [];
  for (const procedure of procedures) {
    const {
      procedures: foundProcedures,
      events: foundEvents
    } = findProceduresAndEventsForProcedure(procedure, dir);
    const filteredFoundProcedures = foundProcedures.filter(p => {
      for (const s of newProcedures) {
        if (objectsEqual(s, p)) return false;
      }
      return true;
    });
    const filteredFoundEvents = foundEvents.filter(e => {
      for (const s of newEvents) {
        if (objectsEqual(s, e)) return false;
      }
      return true;
    });
    newProcedures.push(...filteredFoundProcedures);
    newEvents.push(...filteredFoundEvents);
  }

  const procedureDifference = newProcedures.filter(p => {
    for (const procedure of allProcedures) {
      if (objectsEqual(procedure, p)) return false;
    }
    return true;
  });

  const eventDifference = newEvents.filter(e => {
    for (const event of allEvents) {
      if (objectsEqual(event, e)) return false;
    }
    return true;
  });

  if (procedureDifference.length == 0)
    return { procedures: allProcedures, events: allEvents };

  return findProceduresAndEvents(
    procedureDifference,
    dir,
    [...allProcedures, ...procedureDifference],
    [...allEvents, ...eventDifference]
  );
};

module.exports = procedures => {
  if (!procedures) return;
  const dir = rootDir.path();
  return findProceduresAndEvents(procedures, dir, procedures, []);
};
