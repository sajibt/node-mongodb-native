import { TestBuilder, UnifiedTestSuiteBuilder } from '../../tools/utils';

new UnifiedTestSuiteBuilder('change stream document shapes')
  .runOnRequirement({
    minServerVersion: '4.0.0',
    topologies: ['replicaset', 'load-balanced', 'sharded', 'sharded-replicaset']
  })
  .createEntities([
    ...UnifiedTestSuiteBuilder.defaultEntities,

    // transaction test
    { session: { id: 'session0', client: 'client0' } },

    // rename test
    { database: { id: 'admin', databaseName: 'admin', client: 'client0' } },
    { database: { id: 'renameDb', databaseName: 'renameDb', client: 'client0' } },
    { collection: { id: 'collToRename', collectionName: 'collToRename', database: 'renameDb' } },

    // drop test
    { database: { id: 'dbToDrop', databaseName: 'dbToDrop', client: 'client0' } },
    { collection: { id: 'collInDbToDrop', collectionName: 'collInDbToDrop', database: 'dbToDrop' } }
  ])
  .test(
    new TestBuilder('change stream dropDatabase, drop, and invalidate events')
      .operation({
        object: 'client0',
        name: 'createChangeStream',
        saveResultAsEntity: 'changeStreamOnClient'
      })
      .operation({
        object: 'collInDbToDrop',
        name: 'createChangeStream',
        saveResultAsEntity: 'changeStreamOnCollection'
      })
      .operation({
        object: 'dbToDrop',
        name: 'runCommand',
        arguments: { command: { dropDatabase: 1 } },
        expectResult: { ok: 1 }
      })
      .operation({
        object: 'changeStreamOnClient',
        name: 'iterateUntilDocumentOrError',
        expectResult: {
          _id: { $$exists: true },
          operationType: 'drop',
          ns: { db: 'dbToDrop', coll: 'collInDbToDrop' },
          clusterTime: { $$type: 'timestamp' },
          txnNumber: { $$exists: false },
          lsid: { $$exists: false }
        }
      })
      .operation({
        object: 'changeStreamOnClient',
        name: 'iterateUntilDocumentOrError',
        expectResult: {
          _id: { $$exists: true },
          operationType: 'dropDatabase',
          ns: { db: 'dbToDrop', coll: { $$exists: false } },
          clusterTime: { $$type: 'timestamp' },
          txnNumber: { $$exists: false },
          lsid: { $$exists: false }
        }
      })
      .operation({
        object: 'changeStreamOnCollection',
        name: 'iterateUntilDocumentOrError',
        expectResult: {
          _id: { $$exists: true },
          operationType: 'drop',
          ns: { db: 'dbToDrop', coll: 'collInDbToDrop' },
          clusterTime: { $$type: 'timestamp' },
          txnNumber: { $$exists: false },
          lsid: { $$exists: false }
        }
      })
      .operation({
        object: 'changeStreamOnCollection',
        name: 'iterateUntilDocumentOrError',
        expectResult: {
          _id: { $$exists: true },
          operationType: 'invalidate',
          clusterTime: { $$type: 'timestamp' },
          txnNumber: { $$exists: false },
          lsid: { $$exists: false }
        }
      })
      .toJSON()
  )
  .test(
    new TestBuilder('change stream event inside transaction')
      .operation({
        object: 'collection0',
        name: 'createChangeStream',
        saveResultAsEntity: 'changeStreamOnCollection'
      })
      .operation({
        name: 'startTransaction',
        object: 'session0'
      })
      .operation({
        name: 'insertOne',
        object: 'collection0',
        arguments: {
          session: 'session0',
          document: {
            _id: 3
          }
        },
        expectResult: {
          $$unsetOrMatches: {
            insertedId: {
              $$unsetOrMatches: 3
            }
          }
        }
      })
      .operation({
        name: 'commitTransaction',
        object: 'session0'
      })
      .operation({
        object: 'changeStreamOnCollection',
        name: 'iterateUntilDocumentOrError',
        expectResult: {
          _id: { $$exists: true },
          operationType: 'insert',
          fullDocument: { _id: 3 },
          documentKey: { _id: 3 },
          ns: { db: 'database0', coll: 'collection0' },
          clusterTime: { $$type: 'timestamp' },
          txnNumber: { $$type: ['long', 'int'] },
          lsid: { $$sessionLsid: 'session0' }
        }
      })
      .toJSON()
  )
  .test(
    new TestBuilder('change stream rename event')
      .operation({
        object: 'renameDb',
        name: 'createChangeStream',
        saveResultAsEntity: 'changeStreamOnDb'
      })
      .operation({
        name: 'insertOne',
        object: 'collToRename',
        arguments: {
          document: {
            _id: 3
          }
        },
        expectResult: {
          $$unsetOrMatches: {
            insertedId: {
              $$unsetOrMatches: 3
            }
          }
        }
      })
      .operation({
        object: 'changeStreamOnDb',
        name: 'iterateUntilDocumentOrError',
        expectResult: {
          _id: { $$exists: true },
          operationType: 'insert',
          fullDocument: { _id: 3 },
          documentKey: { _id: 3 },
          ns: { db: 'renameDb', coll: 'collToRename' },
          clusterTime: { $$type: 'timestamp' },
          txnNumber: { $$exists: false },
          lsid: { $$exists: false }
        }
      })
      .operation({
        name: 'runCommand',
        object: 'admin',
        arguments: {
          command: {
            renameCollection: 'renameDb.collToRename',
            to: 'renameDb.newCollectionName',
            dropTarget: false
          }
        },
        expectResult: { ok: 1 }
      })
      .operation({
        object: 'changeStreamOnDb',
        name: 'iterateUntilDocumentOrError',
        expectResult: {
          _id: { $$exists: true },
          operationType: 'rename',
          ns: { db: 'renameDb', coll: 'collToRename' },
          to: { db: 'renameDb', coll: 'newCollectionName' },
          clusterTime: { $$type: 'timestamp' },
          txnNumber: { $$exists: false },
          lsid: { $$exists: false }
        }
      })
      .toJSON()
  )
  .toMocha();
