import { EJSON } from 'bson';
import { expect } from 'chai';
import { inspect, promisify } from 'util';

import { Logger } from '../../src/logger';
import { deprecateOptions, DeprecateOptionsConfig } from '../../src/utils';
import {
  CollectionData,
  EntityDescription,
  ExpectedEventsForClient,
  OperationDescription,
  RunOnRequirement,
  Test,
  UnifiedSuite
} from './unified-spec-runner/schema';

export function makeTestFunction(config: DeprecateOptionsConfig) {
  const fn = (options: any) => {
    if (options) options = null;
  };
  return deprecateOptions(config, fn);
}

export function ensureCalledWith(stub: any, args: any[]) {
  args.forEach((m: any) => expect(stub).to.have.been.calledWith(m));
}

// creation of class with a logger
export function ClassWithLogger() {
  this.logger = new Logger('ClassWithLogger');
}

ClassWithLogger.prototype.f = makeTestFunction({
  name: 'f',
  deprecatedOptions: ['maxScan', 'snapshot', 'fields'],
  optionsIndex: 0
});

ClassWithLogger.prototype.getLogger = function () {
  return this.logger;
};

// creation of class without a logger
export function ClassWithoutLogger() {
  // empty function for class
}

ClassWithoutLogger.prototype.f = makeTestFunction({
  name: 'f',
  deprecatedOptions: ['maxScan', 'snapshot', 'fields'],
  optionsIndex: 0
});

// creation of class where getLogger returns undefined
export function ClassWithUndefinedLogger() {
  // empty function for class
}

ClassWithUndefinedLogger.prototype.f = makeTestFunction({
  name: 'f',
  deprecatedOptions: ['maxScan', 'snapshot', 'fields'],
  optionsIndex: 0
});

ClassWithUndefinedLogger.prototype.getLogger = function () {
  return undefined;
};

export class EventCollector {
  private _events: Record<string, any[]>;
  private _timeout: number;
  constructor(
    obj: { on: (arg0: any, arg1: (event: any) => number) => void },
    events: any[],
    options: { timeout: number }
  ) {
    this._events = Object.create(null);
    this._timeout = options ? options.timeout : 5000;

    events.forEach((eventName: string | number) => {
      this._events[eventName] = [];
      obj.on(eventName, (event: any) => this._events[eventName].push(event));
    });
  }

  waitForEvent(eventName: any, count: number, callback: any) {
    if (typeof count === 'function') {
      callback = count;
      count = 1;
    }

    this.waitForEventImpl(this, Date.now(), eventName, count, callback);
  }

  reset(eventName: string) {
    if (eventName == null) {
      Object.keys(this._events).forEach(eventName => {
        this._events[eventName] = [];
      });

      return;
    }

    if (this._events[eventName] == null) {
      throw new TypeError(`invalid event name "${eventName}" specified for reset`);
    }

    this._events[eventName] = [];
  }

  waitForEventImpl(
    collector: this,
    start: number,
    eventName: string | number,
    count: number,
    callback: (error?: Error, events?: any[]) => void
  ) {
    const events = collector._events[eventName];
    if (events.length >= count) {
      return callback(undefined, events);
    }

    if (Date.now() - start >= collector._timeout) {
      return callback(new Error(`timed out waiting for event "${eventName}"`));
    }

    setTimeout(() => this.waitForEventImpl(collector, start, eventName, count, callback), 10);
  }
}

export function getSymbolFrom(target: any, symbolName: any, assertExists = true) {
  const symbol = Object.getOwnPropertySymbols(target).filter(
    s => s.toString() === `Symbol(${symbolName})`
  )[0];

  if (assertExists && !symbol) {
    throw new Error(`Did not find Symbol(${symbolName}) on ${target}`);
  }

  return symbol;
}

export function getEnvironmentalOptions() {
  const options = {};
  if (process.env.MONGODB_API_VERSION) {
    Object.assign(options, {
      serverApi: { version: process.env.MONGODB_API_VERSION }
    });
  }
  if (process.env.SERVERLESS) {
    Object.assign(options, {
      auth: {
        username: process.env.SERVERLESS_ATLAS_USER,
        password: process.env.SERVERLESS_ATLAS_PASSWORD
      },
      tls: true,
      compressors: 'snappy,zlib'
    });
  }
  return options;
}

export function shouldRunServerlessTest(testRequirement: any, isServerless: any) {
  if (!testRequirement) return true;
  switch (testRequirement) {
    case 'forbid':
      // return true if the configuration is NOT serverless
      return !isServerless;
    case 'allow':
      // always return true
      return true;
    case 'require':
      // only return true if the configuration is serverless
      return isServerless;
    default:
      throw new Error(`Invalid serverless filter: ${testRequirement}`);
  }
}

/**
 * Use as a template string tag to stringify objects in the template string
 * Attempts to use EJSON (to make type information obvious)
 * falls back to util.inspect if there's an error (circular reference)
 */
export function ejson(strings: TemplateStringsArray, ...values: any[]) {
  const stringParts = [strings[0]];
  for (const [idx, value] of values.entries()) {
    if (typeof value === 'object') {
      let stringifiedObject: string;
      try {
        stringifiedObject = EJSON.stringify(value, { relaxed: false });
      } catch (error) {
        stringifiedObject = inspect(value, {
          depth: Infinity,
          showHidden: true,
          compact: true
        });
      }
      stringParts.push(stringifiedObject);
    } else {
      stringParts.push(String(value));
    }
    stringParts.push(strings[idx + 1]);
  }

  return stringParts.join('');
}

/**
 * Run an async function after some set timeout
 * @param fn - function to run
 * @param ms - timeout in MS
 */
export const runLater = (fn: () => Promise<void>, ms: number) => {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => fn().then(resolve).catch(reject), ms);
  });
};

export const sleep = promisify(setTimeout);

/**
 * If you are using sinon fake timers, it can end up blocking queued IO from running
 * awaiting a nextTick call will allow the event loop to process Networking/FS callbacks
 */
export const processTick = () => new Promise(resolve => process.nextTick(resolve));

export function getIndicesOfAuthInUrl(connectionString: string | string[]) {
  const doubleSlashIndex = connectionString.indexOf('//');
  const atIndex = connectionString.indexOf('@');

  if (doubleSlashIndex === -1 || atIndex === -1) {
    return null;
  }

  return {
    start: doubleSlashIndex + 2,
    end: atIndex
  };
}

export function removeAuthFromConnectionString(connectionString: string) {
  const indices = getIndicesOfAuthInUrl(connectionString);
  if (!indices) {
    return connectionString;
  }

  const { start, end } = indices;

  if (start === -1 || end === -1) {
    return connectionString;
  }

  return connectionString.slice(0, start) + connectionString.slice(end + 1);
}

export function extractAuthFromConnectionString(connectionString: string | any[]) {
  const indices = getIndicesOfAuthInUrl(connectionString);
  if (!indices) {
    return null;
  }

  return connectionString.slice(indices.start, indices.end);
}

export interface FailPoint {
  configureFailPoint: 'failCommand';
  mode: { activationProbability: number } | { times: number } | 'alwaysOn' | 'off';
  data: {
    failCommands: string[];
    errorCode?: number;
    closeConnection?: boolean;
    blockConnection?: boolean;
    blockTimeMS?: number;
    writeConcernError?: { code: number; errmsg: string };
    threadName?: string;
    failInternalCommands?: boolean;
    errorLabels?: string[];
    appName?: string;
  };
}

export class TestBuilder {
  private _description: string;
  private runOnRequirements: RunOnRequirement[] = [];
  private _skipReason?: string;
  private _operations: OperationDescription[] = [];
  private _expectEvents?: ExpectedEventsForClient[] = [];
  private _outcome?: CollectionData[] = [];

  constructor(description: string) {
    this._description = description;
  }

  operation(operation: OperationDescription): this {
    this._operations.push({
      object: 'collection0',
      ...operation
    });
    return this;
  }

  runOnRequirement(requirement: RunOnRequirement): this {
    this.runOnRequirements.push(requirement);
    return this;
  }

  expectEvents(event: ExpectedEventsForClient): this {
    this._expectEvents.push(event);
    return this;
  }

  toJSON(): Test {
    const test: Test = {
      description: this._description,
      runOnRequirements: this.runOnRequirements,
      operations: this._operations,
      expectEvents: this._expectEvents,
      outcome: this._outcome
    };

    if (this._skipReason != null) {
      test.skipReason = this._skipReason;
    }

    return test;
  }
}

export class UnifiedTestSuiteBuilder {
  private _description = 'Default Description';
  private _databaseName = '';
  private _schemaVersion = '1.0';
  private _createEntities: EntityDescription[] = [
    {
      client: {
        id: 'client0',
        useMultipleMongoses: true,
        observeEvents: ['commandStartedEvent']
      }
    },
    {
      database: {
        id: 'database0',
        client: 'client0',
        databaseName: ''
      }
    },
    {
      collection: {
        id: 'collection0',
        database: 'database0',
        collectionName: 'coll0'
      }
    }
  ];
  private _runOnRequirement: RunOnRequirement[] = [];
  private _initialData: CollectionData[] = [];
  private _tests: Test[] = [];

  constructor(description: string) {
    this._description = description;
  }

  description(description: string): this {
    this._description = description;
    return this;
  }

  test(test: Test): this;
  test(test: Test[]): this;
  test(test: Test | Test[]): this {
    if (Array.isArray(test)) {
      this._tests.push(...test);
    } else {
      this._tests.push(test);
    }
    return this;
  }

  createEntities(entity: EntityDescription): this;
  createEntities(entity: EntityDescription[]): this;
  createEntities(entity: EntityDescription | EntityDescription[]): this {
    if (Array.isArray(entity)) {
      this._createEntities.push(...entity);
    } else {
      this._createEntities.push(entity);
    }
    return this;
  }

  initialData(data: CollectionData): this;
  initialData(data: CollectionData[]): this;
  initialData(data: CollectionData | CollectionData[]): this {
    if (Array.isArray(data)) {
      this._initialData.push(...data);
    } else {
      this._initialData.push(data);
    }
    return this;
  }

  /**
   * sets the database name for the tests
   */
  databaseName(name: string): this {
    this._databaseName = name;
    return this;
  }

  runOnRequirement(requirement: RunOnRequirement): this;
  runOnRequirement(requirement: RunOnRequirement[]): this;
  runOnRequirement(requirement: RunOnRequirement | RunOnRequirement[]): this {
    Array.isArray(requirement)
      ? this._runOnRequirement.push(...requirement)
      : this._runOnRequirement.push(requirement);
    return this;
  }

  schemaVersion(version: string): this {
    this._schemaVersion = version;
    return this;
  }

  toJSON(): UnifiedSuite {
    const databaseName =
      this._databaseName !== ''
        ? this._databaseName
        : this._description
            .split(' ')
            .filter(s => s.length > 0)
            .join('_');
    return {
      description: this._description,
      schemaVersion: this._schemaVersion,
      runOnRequirements: this._runOnRequirement,
      createEntities: this._createEntities.map(entity => {
        if ('database' in entity) {
          return {
            database: { ...entity.database, databaseName }
          };
        }

        return entity;
      }),
      initialData: this._initialData.map(data => {
        return {
          ...data,
          databaseName
        };
      }),
      tests: this._tests
    };
  }

  clone(): UnifiedSuite {
    return JSON.parse(JSON.stringify(this));
  }
}
