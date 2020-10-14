### Blossm is a javascript Event Sourcing CQRS orchestrator. 

CQRS is a Event Sourcing software architecture pattern where the write and read responsibilites are organized around seperate data stores. 
The write side takes a request, performs a routine, and optionally logs some events with metadata to a store, thus modifying the state of the app forever — the event stores are immutable. 
The read side listens for logged events and uses their metadata to write to any number of denormalized view stores to be queried, and which can be destroyed and recreated at any time based on the event log. 

Blossm does this with 8 types of procedures, all of which can be run as lambda functions on GCP Cloud Run, configured entirely with blossm.yaml files, and deployed with a CLI.

#### First, here's a high level overview of what they each do: 

#### On the write side:

* `__Event Store__` - Deployed to log events with a shared schema. Events that share a `root` refer to the same entity, and can be aggregated to determine the state of that entity at any point in time. Event Store's connect to a Collection in a MongoDB Atlas instance. 

* __Command__ - Deployed to do a single-purpose job on-demand which has the oportunity to log events throughout it's execution. Commands can call other commands.

* __Fact__ - Deployed to deliver some specic information about the state of the app.

* __Command Gateway__ - Deployed to permit access to a set of Commands under specified conditions.

* __Fact Gateway__ - Deployed to permit access to a set of Facts under specified conditions.


#### On the read side:

* __View Store__ - Deployed to store denormalized data that is intended to be queried. Connects to a Collection in a MongoDB Atlas.

* __Projection__ - Deployed to listen for Events and map their data to a View Store. If the projection is changed, it can be replayed on-demand using a CLI, which will update the View Store with the most recent mapping.

* __View Gateway__ - Deployed to permit access to a set of View stores under specified conditions.


### Write-side Procedure Organization

Functionality is organized in 3 layers that help you organize your code:

* __Domain__ - Each domain has one __Event Store__ and can have one __Command Gateway__ to allow external access to it's __Command__s.

* __Services__ - Each service is made up of any number of interdependant __Domain__s, meaning the __Command__s from within a __Service__ s can freely save events to any of it's __View Store__s. __Service's can also depend on other services unidirectionally. 

* __Network__ - Each network is made up of any number of __Services__'s who's __Commands__ can call each other directly without a gateway.
