const BOOLEAN_TYPES = new Set(['boolean', 'bool']);
const INTEGER_TYPES = new Set(['integer', 'int']);
const NUMBER_TYPES = new Set(['number', 'float', 'double', 'decimal']);
const DATE_TYPES = new Set(['date', 'datetime', 'datetime-local', 'time']);

const inferTypeFromValue = (value) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (value instanceof Date) {
    return 'datetime-local';
  }

  return 'string';
};

const normalizeType = (type, defaultValue) => {
  if (!type && defaultValue !== undefined) {
    return inferTypeFromValue(defaultValue);
  }

  if (typeof type !== 'string') {
    return 'string';
  }

  const lowerType = type.toLowerCase();

  if (BOOLEAN_TYPES.has(lowerType)) {
    return 'boolean';
  }

  if (INTEGER_TYPES.has(lowerType)) {
    return 'integer';
  }

  if (NUMBER_TYPES.has(lowerType)) {
    return 'number';
  }

  if (DATE_TYPES.has(lowerType)) {
    return lowerType === 'datetime' ? 'datetime-local' : lowerType;
  }

  if (lowerType === 'text') {
    return 'string';
  }

  return lowerType;
};

const normalizeOptions = (options) => {
  if (!Array.isArray(options) || options.length === 0) {
    return undefined;
  }

  return options.map((option, index) => {
    if (option && typeof option === 'object') {
      const hasValue = Object.prototype.hasOwnProperty.call(option, 'value');
      const actualValue = hasValue ? option.value : option.id ?? option.key ?? index;
      const label = option.label ?? String(actualValue);

      return {
        label: String(label),
        value: actualValue,
        stringValue: actualValue === undefined || actualValue === null ? '' : String(actualValue),
      };
    }

    const actualValue = option;

    return {
      label: String(actualValue),
      value: actualValue,
      stringValue: actualValue === undefined || actualValue === null ? '' : String(actualValue),
    };
  });
};

const coerceValue = (metadata, value) => {
  const { type } = metadata;

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' && value === '') {
    if (BOOLEAN_TYPES.has(type) || INTEGER_TYPES.has(type) || NUMBER_TYPES.has(type) || DATE_TYPES.has(type)) {
      return undefined;
    }

    return '';
  }

  if (BOOLEAN_TYPES.has(type)) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
        return true;
      }

      if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
        return false;
      }
    }

    return Boolean(value);
  }

  if (INTEGER_TYPES.has(type)) {
    const source = typeof value === 'string' ? value.trim() : value;
    if (typeof source === 'string' && source === '') {
      return undefined;
    }

    const numberValue = typeof source === 'number' ? source : Number.parseInt(source, 10);
    return Number.isNaN(numberValue) ? undefined : numberValue;
  }

  if (NUMBER_TYPES.has(type)) {
    const source = typeof value === 'string' ? value.trim() : value;
    if (typeof source === 'string' && source === '') {
      return undefined;
    }

    const numberValue = typeof source === 'number' ? source : Number(source);
    return Number.isNaN(numberValue) ? undefined : numberValue;
  }

  if (DATE_TYPES.has(type)) {
    if (value instanceof Date) {
      if (type === 'date') {
        return value.toISOString().slice(0, 10);
      }

      if (type === 'time') {
        return value.toISOString().slice(11, 16);
      }

      return value.toISOString().slice(0, 16);
    }

    return String(value);
  }

  return typeof value === 'string' ? value : String(value);
};

const normalizeInputMetadata = (inputMetadata) => {
  if (!inputMetadata || typeof inputMetadata !== 'object' || Array.isArray(inputMetadata)) {
    const defaultValue = inputMetadata;
    const type = normalizeType(undefined, defaultValue);

    return {
      type,
      options: undefined,
      defaultValue: coerceValue({ type }, defaultValue),
      required: false,
      min: undefined,
      max: undefined,
      description: '',
    };
  }

  const {
    type: rawType,
    options,
    default: defaultValue,
    required,
    min,
    max,
    description,
  } = inputMetadata;

  const normalizedType = normalizeType(rawType, defaultValue);
  const normalizedOptions = normalizeOptions(options);

  const metadata = {
    type: normalizedType,
    options: normalizedOptions,
    required: Boolean(required),
    description: description ? String(description) : '',
    min: min,
    max: max,
    defaultValue: coerceValue({ type: normalizedType }, defaultValue),
  };

  if (normalizedType === 'integer' || normalizedType === 'number') {
    metadata.min = min === undefined || min === null ? undefined : Number(min);
    metadata.max = max === undefined || max === null ? undefined : Number(max);
  }

  if (DATE_TYPES.has(normalizedType)) {
    metadata.min = min === undefined || min === null ? undefined : coerceValue({ type: normalizedType }, min);
    metadata.max = max === undefined || max === null ? undefined : coerceValue({ type: normalizedType }, max);
  }

  return metadata;
};

const isValueEmpty = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const validateValue = (metadata, value, rawValue = value) => {
  const { type, required, min, max } = metadata;
  const rawIsEmpty = isValueEmpty(rawValue);
  const valueIsEmpty = isValueEmpty(value);

  if (required) {
    if (BOOLEAN_TYPES.has(type)) {
      if (value !== true) {
        return { isValid: false, error: 'This field must be checked.' };
      }
    } else if (rawIsEmpty) {
      return { isValid: false, error: 'This field is required.' };
    }
  }

  if (rawIsEmpty) {
    return { isValid: true };
  }

  if (INTEGER_TYPES.has(type) || NUMBER_TYPES.has(type)) {
    if (valueIsEmpty || typeof value !== 'number' || Number.isNaN(value)) {
      return { isValid: false, error: 'Please enter a valid number.' };
    }

    if (min !== undefined && value < Number(min)) {
      return { isValid: false, error: `Value must be at least ${min}.` };
    }

    if (max !== undefined && value > Number(max)) {
      return { isValid: false, error: `Value must be at most ${max}.` };
    }
  }

  if (DATE_TYPES.has(type)) {
    if (valueIsEmpty) {
      return { isValid: false, error: 'Please enter a valid date.' };
    }

    const parsedDate = parseDateValue(value);

    if (!parsedDate) {
      return { isValid: false, error: 'Please enter a valid date.' };
    }

    if (min) {
      const minDate = parseDateValue(min);
      if (minDate && parsedDate < minDate) {
        return { isValid: false, error: 'Date must be on or after the minimum date.' };
      }
    }

    if (max) {
      const maxDate = parseDateValue(max);
      if (maxDate && parsedDate > maxDate) {
        return { isValid: false, error: 'Date must be on or before the maximum date.' };
      }
    }
  }

  return { isValid: true };
};

const getLabelFromKey = (key) => {
  if (typeof key !== 'string') {
    return '';
  }

  return key
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatValueForInput = (metadata, value) => {
  const { type, options } = metadata;

  if (options && options.length > 0) {
    if (value === undefined || value === null) {
      return '';
    }

    const match = options.find(
      (option) => option.value === value || option.stringValue === String(value),
    );

    return match ? match.stringValue : String(value);
  }

  if (BOOLEAN_TYPES.has(type)) {
    return value === true;
  }

  if (INTEGER_TYPES.has(type) || NUMBER_TYPES.has(type)) {
    if (value === undefined || value === null) {
      return '';
    }

    return String(value);
  }

  if (DATE_TYPES.has(type)) {
    return value ?? '';
  }

  return value ?? '';
};

const normalizeInputSchemaForEditor = (schema) => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return [];
  }

  return Object.entries(schema).map(([name, definition]) => {
    const metadata = normalizeInputMetadata(definition);
    const formattedDefault = formatValueForInput(metadata, metadata.defaultValue);

    return {
      name: typeof name === 'string' ? name : '',
      type: metadata.type,
      required: Boolean(metadata.required),
      defaultValue: formattedDefault,
    };
  });
};

const validateInputParameterDefinition = (entry, options = {}) => {
  const { requireName = true } = options;

  const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
  if (requireName && !name) {
    return { isValid: false, error: 'Parameter name is required.' };
  }

  const normalizedType = normalizeType(entry?.type, entry?.defaultValue);
  const metadata = { type: normalizedType };

  const rawValue = entry?.defaultValue;
  if (isValueEmpty(rawValue)) {
    return { isValid: true, normalizedType, parsedDefault: undefined };
  }

  const parsedDefault = coerceValue(metadata, rawValue);
  const validation = validateValue(metadata, parsedDefault, rawValue);

  if (!validation.isValid) {
    return { isValid: false, error: validation.error || 'Invalid default value.' };
  }

  return { isValid: true, normalizedType, parsedDefault };
};

const buildInputSchemaFromEntries = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { schema: {}, errors: [] };
  }

  const schema = {};
  const errors = [];
  const seenNames = new Set();

  entries.forEach((entry, index) => {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';

    if (!name) {
      errors.push(`Parameter ${index + 1} must include a name.`);
      return;
    }

    if (seenNames.has(name)) {
      errors.push(`Duplicate parameter name "${name}".`);
      return;
    }

    seenNames.add(name);

    const validation = validateInputParameterDefinition(entry, { requireName: false });
    if (!validation.isValid) {
      errors.push(`Parameter "${name}": ${validation.error}`);
      return;
    }

    const definition = {
      type: validation.normalizedType,
    };

    if (entry?.required) {
      definition.required = true;
    }

    if (!isValueEmpty(validation.parsedDefault)) {
      definition.default = validation.parsedDefault;
    }

    schema[name] = definition;
  });

  return { schema, errors };
};

export {
  BOOLEAN_TYPES,
  INTEGER_TYPES,
  NUMBER_TYPES,
  DATE_TYPES,
  inferTypeFromValue,
  normalizeType,
  normalizeOptions,
  coerceValue,
  normalizeInputMetadata,
  isValueEmpty,
  parseDateValue,
  validateValue,
  getLabelFromKey,
  formatValueForInput,
  normalizeInputSchemaForEditor,
  validateInputParameterDefinition,
  buildInputSchemaFromEntries,
};

