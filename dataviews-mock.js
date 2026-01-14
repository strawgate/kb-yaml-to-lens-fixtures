#!/usr/bin/env node
/**
 * Simplified DataViews mock for fixture generation
 *
 * Based on Kibana's official mockDataViewsService from:
 * /kibana/src/platform/packages/shared/kbn-lens-embeddable-utils/config_builder/charts/mock_utils.ts
 *
 * This is a non-Jest version suitable for standalone script execution.
 * Enhanced to support both v8.x and v9.x Kibana versions.
 */

/**
 * Field type definitions with full metadata
 * These match what Kibana expects from DataView fields
 */
const FIELD_TYPES = {
  datetime: {
    type: 'date',
    esTypes: ['date'],
    searchable: true,
    aggregatable: true,
    filterable: true,
    sortable: true,
  },
  string: {
    type: 'string',
    esTypes: ['keyword'],
    searchable: true,
    aggregatable: true,
    filterable: true,
    sortable: true,
  },
  text: {
    type: 'string',
    esTypes: ['text'],
    searchable: true,
    aggregatable: false,
    filterable: true,
    sortable: false,
  },
  number: {
    type: 'number',
    esTypes: ['long', 'integer', 'double', 'float'],
    searchable: true,
    aggregatable: true,
    filterable: true,
    sortable: true,
  },
  boolean: {
    type: 'boolean',
    esTypes: ['boolean'],
    searchable: true,
    aggregatable: true,
    filterable: true,
    sortable: true,
  },
  ip: {
    type: 'ip',
    esTypes: ['ip'],
    searchable: true,
    aggregatable: true,
    filterable: true,
    sortable: true,
  },
  geo_point: {
    type: 'geo_point',
    esTypes: ['geo_point'],
    searchable: true,
    aggregatable: true,
    filterable: true,
    sortable: false,
  },
};

/**
 * Common field mappings used across examples
 */
const COMMON_FIELDS = {
  '@timestamp': 'datetime',
  'timestamp': 'datetime',
  'category': 'string',
  'agent.name': 'string',
  'host.name': 'string',
  'log.level': 'string',
  'geo.src': 'string',
  'geo.dest': 'string',
  'source': 'string',
  'destination': 'string',
  'status': 'string',
  'method': 'string',
  'url': 'string',
  'user.name': 'string',
  'service.name': 'string',
  'response_time': 'number',
  'price': 'number',
  'bytes': 'number',
  'count': 'number',
  'value': 'number',
  'duration': 'number',
  'memory': 'number',
  'cpu': 'number',
  'temperature': 'number',
  'errors': 'number',
  'requests': 'number',
  'success': 'boolean',
  'enabled': 'boolean',
  'client.ip': 'ip',
  'server.ip': 'ip',
  'location': 'geo_point',
};

/**
 * Creates a mock field object with all required properties
 */
function createMockField(name, fieldTypeName = 'string') {
  const fieldType = FIELD_TYPES[fieldTypeName] || FIELD_TYPES.string;

  return {
    name,
    displayName: name,
    type: fieldType.type,
    esTypes: fieldType.esTypes,
    searchable: fieldType.searchable,
    aggregatable: fieldType.aggregatable,
    filterable: fieldType.filterable,
    sortable: fieldType.sortable,
    readFromDocValues: true,
    scripted: false,
    isMapped: true,
    count: 0,
    // Additional methods that may be called
    toSpec: () => ({
      name,
      type: fieldType.type,
      esTypes: fieldType.esTypes,
      searchable: fieldType.searchable,
      aggregatable: fieldType.aggregatable,
    }),
  };
}

/**
 * Determines the field type based on the field name
 */
function getFieldType(name) {
  // Check common fields first
  if (COMMON_FIELDS[name]) {
    return COMMON_FIELDS[name];
  }

  // Infer from field name patterns
  if (name.includes('timestamp') || name.includes('date') || name.startsWith('@')) {
    return 'datetime';
  }
  if (name.includes('count') || name.includes('bytes') || name.includes('size') ||
      name.includes('duration') || name.includes('time') || name.includes('latency') ||
      name.includes('rate') || name.includes('percent') || name.includes('avg') ||
      name.includes('sum') || name.includes('min') || name.includes('max')) {
    return 'number';
  }
  if (name.includes('.ip') || name === 'ip') {
    return 'ip';
  }
  if (name.includes('geo') || name.includes('location') || name.includes('coordinates')) {
    return 'geo_point';
  }
  if (name.includes('enabled') || name.includes('active') || name.includes('success') ||
      name.includes('failed') || name.includes('is_')) {
    return 'boolean';
  }

  // Default to string (keyword)
  return 'string';
}

/**
 * Creates a mock fields collection with array-like and map-like behavior
 */
function createMockFieldsCollection() {
  const fieldsMap = new Map();

  const collection = {
    getByName: (name) => {
      if (!fieldsMap.has(name)) {
        const fieldType = getFieldType(name);
        fieldsMap.set(name, createMockField(name, fieldType));
      }
      return fieldsMap.get(name);
    },
    getByType: (type) => {
      return Array.from(fieldsMap.values()).filter(f => f.type === type);
    },
    getAll: () => Array.from(fieldsMap.values()),
    filter: (predicate) => Array.from(fieldsMap.values()).filter(predicate),
    find: (predicate) => Array.from(fieldsMap.values()).find(predicate),
    map: (fn) => Array.from(fieldsMap.values()).map(fn),
    forEach: (fn) => fieldsMap.forEach((v, k) => fn(v, k)),
    [Symbol.iterator]: () => fieldsMap.values(),
  };

  return collection;
}

/**
 * Creates a simple mock data view object
 */
function createMockDataView({ id = 'test', title = 'logs-*', timeFieldName = '@timestamp' } = {}) {
  const fields = createMockFieldsCollection();

  // Pre-populate the time field
  if (timeFieldName) {
    fields.getByName(timeFieldName);
  }

  return {
    id,
    title,
    name: title,
    timeFieldName,
    metaFields: ['_source', '_id', '_type', '_index', '_score'],
    fields,
    // Methods
    isPersisted: () => true,
    isTimeBased: () => !!timeFieldName,
    getTimeField: () => timeFieldName ? fields.getByName(timeFieldName) : undefined,
    getFieldByName: (name) => fields.getByName(name),
    toSpec: () => ({
      id,
      title,
      timeFieldName,
    }),
    toMinimalSpec: () => ({
      id,
      title,
      timeFieldName,
    }),
    // For compatibility with different Kibana versions
    getIndexPattern: () => title,
    getFormatterForField: () => ({ convert: (v) => String(v) }),
  };
}

/**
 * Creates a mock DataViews service compatible with DataViewsCommon interface
 *
 * Implements the minimal interface required by LensConfigBuilder:
 * - get(id): retrieve a data view by ID
 * - create({ id, title, timeFieldName }): create a new data view
 */
export function createDataViewsMock() {
  const dataViewsCache = new Map();

  return {
    /**
     * Mock get() method - returns a data view for the given ID
     */
    async get(id) {
      // Check cache first
      if (dataViewsCache.has(id)) {
        return dataViewsCache.get(id);
      }

      // Parse the ID if it's a JSON string (as used by some chart builders)
      let dataViewId = id;
      let title = 'logs-*';
      let timeFieldName = '@timestamp';

      try {
        const parsed = JSON.parse(id);
        if (parsed.index) {
          dataViewId = parsed.index;
          title = parsed.index;
        }
        if (parsed.timeFieldName) {
          timeFieldName = parsed.timeFieldName;
        }
      } catch {
        // Not JSON, use as-is
        title = id;
      }

      const dataView = createMockDataView({ id: dataViewId, title, timeFieldName });
      dataViewsCache.set(id, dataView);
      return dataView;
    },

    /**
     * Mock create() method - returns a new data view
     */
    async create({ id, title, timeFieldName = '@timestamp' } = {}) {
      const dataView = createMockDataView({
        id: id || 'created-dataview',
        title: title || 'logs-*',
        timeFieldName
      });
      if (id) {
        dataViewsCache.set(id, dataView);
      }
      return dataView;
    },

    /**
     * Mock getDefaultDataView() method
     */
    async getDefaultDataView() {
      return createMockDataView({ id: 'default', title: 'logs-*' });
    },

    /**
     * Mock find() method - for searching data views
     */
    async find(search) {
      return Array.from(dataViewsCache.values());
    },

    /**
     * Mock getIds() method
     */
    async getIds() {
      return Array.from(dataViewsCache.keys());
    },

    /**
     * Clear the cache (useful for testing)
     */
    clearCache() {
      dataViewsCache.clear();
    },
  };
}
