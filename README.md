# node-orders-microservice

A simple node orders microservice sample, it is not full example(no Auth, no validation, no dependency separation ...). this project meant only to practice communication between services.

## steps

- [x] create orders service.
- [x] Setup docker config.
- [x] Create orders table.
- [x] add get and create order endpoints.
- [x] setup event Bus.
- [x] add volume to kafka. 
- [x] CREATE PRODUCT service.
- [x] SET COMMUNICATION BETWEEN THEM.
- [x] Implement Outbox pattern when order created(created outbox table).
  - [x] using Polling publisher(read from outbox table rows that status is not processed). 
  - using log trailing (POSTGRES WAL using https://github.com/eulerto/wal2json).
- [ ] make consumer idempotent to not consume message more than once.