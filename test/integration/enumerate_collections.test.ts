import { runUnifiedSuite } from '../tools/unified-spec-runner/runner';
import { TestBuilder, UnifiedTestSuiteBuilder } from '../tools/utils';

const testSuite = new UnifiedTestSuiteBuilder('listCollections with comment option')
  .createEntities(UnifiedTestSuiteBuilder.defaultEntities)
  .initialData({
    collectionName: 'collection0',
    databaseName: 'database0',
    documents: [{ _id: 1, x: 11 }]
  })
  .test(
    new TestBuilder('listCollections should not send comment for server versions < 4.4')
      .runOnRequirement({ maxServerVersion: '4.3.99' })
      .operation({
        name: 'listCollections',
        arguments: {
          filter: {},
          comment: 'string value'
        },
        object: 'database0'
      })
      .expectEvents({
        client: 'client0',
        events: [
          {
            commandStartedEvent: {
              command: {
                listCollections: 1
              }
            }
          }
        ]
      })
      .toJSON()
  )
  .test(
    new TestBuilder('listCollections should send string comment for server versions >= 4.4')
      .runOnRequirement({ minServerVersion: '4.4.0' })
      .operation({
        name: 'listCollections',
        arguments: {
          filter: {},
          comment: 'string value'
        },
        object: 'database0'
      })
      .expectEvents({
        client: 'client0',
        events: [
          {
            commandStartedEvent: {
              command: {
                listCollections: 1,
                comment: 'string value'
              }
            }
          }
        ]
      })
      .toJSON()
  )
  .test(
    new TestBuilder('listCollections should send non-string comment for server versions >= 4.4')
      .runOnRequirement({ minServerVersion: '4.4.0' })
      .operation({
        name: 'listCollections',
        arguments: {
          filter: {},

          comment: {
            key: 'value'
          }
        },
        object: 'database0'
      })
      .expectEvents({
        client: 'client0',
        events: [
          {
            commandStartedEvent: {
              command: {
                listCollections: 1,
                comment: {
                  key: 'value'
                }
              }
            }
          }
        ]
      })
      .toJSON()
  )
  .toJSON();

describe('listCollections with comment option', () => {
  runUnifiedSuite([testSuite]);
});
