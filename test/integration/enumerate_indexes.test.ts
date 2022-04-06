import { runUnifiedSuite } from '../tools/unified-spec-runner/runner';
import { TestBuilder, UnifiedTestSuiteBuilder } from '../tools/utils';

const testSuite = new UnifiedTestSuiteBuilder('listIndexes with comment option')
  .createEntities(UnifiedTestSuiteBuilder.defaultEntities)
  .initialData({
    collectionName: 'collection0',
    databaseName: 'database0',
    documents: [{ _id: 1, x: 11 }]
  })
  .test(
    new TestBuilder('listIndexes should not send comment for server versions < 4.4')
      .runOnRequirement({ maxServerVersion: '4.3.99' })
      .operation({
        name: 'listIndexes',
        arguments: {
          filter: {},
          comment: 'string value'
        },
        object: 'collection0'
      })
      .expectEvents({
        client: 'client0',
        events: [
          {
            commandStartedEvent: {
              command: {}
            }
          }
        ]
      })
      .toJSON()
  )
  .test(
    new TestBuilder('listIndexes should send string comment for server versions >= 4.4')
      .runOnRequirement({ minServerVersion: '4.4.0' })
      .operation({
        name: 'listIndexes',
        arguments: {
          filter: {},
          comment: 'string value'
        },
        object: 'collection0'
      })
      .expectEvents({
        client: 'client0',
        events: [
          {
            commandStartedEvent: {
              command: {
                comment: 'string value'
              }
            }
          }
        ]
      })
      .toJSON()
  )
  .test(
    new TestBuilder('listIndexes should send non-string comment for server versions >= 4.4')
      .runOnRequirement({ minServerVersion: '4.4.0' })
      .operation({
        name: 'listIndexes',
        arguments: {
          filter: {},
          comment: {
            key: 'value'
          }
        },
        object: 'collection0'
      })
      .expectEvents({
        client: 'client0',
        events: [
          {
            commandStartedEvent: {
              command: {
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

describe('listIndexes with comment option', () => {
  runUnifiedSuite([testSuite]);
});
