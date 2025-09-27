import React, { useMemo } from 'react';
import { Info, Settings } from 'lucide-react';

import {
  BOOLEAN_TYPES,
  INTEGER_TYPES,
  NUMBER_TYPES,
  DATE_TYPES,
  coerceValue,
  normalizeInputMetadata,
  validateValue,
  getLabelFromKey,
  formatValueForInput,
} from './crewInputUtils';

const CrewInputsForm = ({
  crew,
  getInputValue,
  onUpdateInput,
  hideHeader = false,
  containerClassName,
  contentClassName = 'space-y-4',
}) => {
  const inputs = useMemo(() => {
    if (!crew || typeof crew !== 'object') {
      return {};
    }

    const crewInputs = crew.inputs;
    if (!crewInputs || typeof crewInputs !== 'object') {
      return {};
    }

    return crewInputs;
  }, [crew]);

  const crewId = crew?.id != null ? String(crew.id) : '';
  const normalizedInputEntries = useMemo(
    () => Object.entries(inputs).map(([key, inputMetadata]) => [key, normalizeInputMetadata(inputMetadata)]),
    [inputs],
  );
  const hasInputs = normalizedInputEntries.length > 0;

  const content = (
    <>
      {!hideHeader && (
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Settings className="h-5 w-5" />
          Input Values
        </h3>
      )}
      <div className={contentClassName}>
        {hasInputs ? (
          normalizedInputEntries.map(([key, metadata]) => {
            const rawValue = typeof getInputValue === 'function' ? getInputValue(key) : undefined;
            const effectiveValue = rawValue !== undefined && rawValue !== null
              ? rawValue
              : metadata.defaultValue;
            const parsedValue = coerceValue(metadata, effectiveValue);
            const displayValue = formatValueForInput(metadata, parsedValue);
            const validation = validateValue(metadata, parsedValue, effectiveValue);
            const inputId = `${crewId}_${key}`;
            const labelText = getLabelFromKey(key) || key;
            const placeholder = metadata.defaultValue != null
              ? String(metadata.defaultValue)
              : '';
            const baseValidationClasses = validation.isValid
              ? 'border-gray-300 focus:ring-blue-500 dark:border-slate-700 dark:focus:ring-blue-500'
              : 'border-red-500 focus:ring-red-500 dark:border-red-500 dark:focus:ring-red-500';
            const inputClassName = `w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:bg-slate-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-offset-slate-900 ${baseValidationClasses}`;
            const descriptionId = metadata.description ? `${inputId}-description` : undefined;
            const errorId = !validation.isValid && validation.error ? `${inputId}-error` : undefined;
            const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

            const handleChange = (event) => {
              if (typeof onUpdateInput !== 'function') {
                return;
              }

              let nextValue;

              if (BOOLEAN_TYPES.has(metadata.type)) {
                nextValue = event.target.checked;
              } else if (metadata.options && metadata.options.length > 0) {
                const selected = metadata.options.find(
                  (option) => option.stringValue === event.target.value,
                );
                nextValue = selected ? selected.value : event.target.value;
              } else if (INTEGER_TYPES.has(metadata.type) || NUMBER_TYPES.has(metadata.type)) {
                nextValue = event.target.value;
              } else {
                nextValue = event.target.value;
              }

              const parsedNextValue = coerceValue(metadata, nextValue);
              const nextValidation = validateValue(metadata, parsedNextValue, nextValue);

              onUpdateInput(key, parsedNextValue, nextValidation);
            };

            if (BOOLEAN_TYPES.has(metadata.type) && (!metadata.options || metadata.options.length === 0)) {
              return (
                <div key={key}>
                  <label
                    htmlFor={inputId}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={displayValue === true}
                      onChange={handleChange}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 transition-colors focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:focus:ring-blue-500"
                      aria-describedby={describedBy}
                      aria-invalid={!validation.isValid}
                    />
                    <span className="flex items-center gap-1.5">
                      {labelText}
                      {metadata.required && <span className="text-red-500">*</span>}
                      {metadata.description && (
                        <span
                          className="inline-flex h-4 w-4 cursor-help items-center justify-center text-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-500 dark:focus-visible:ring-offset-slate-900"
                          tabIndex={0}
                          role="img"
                          aria-label={metadata.description}
                          title={metadata.description}
                        >
                          <Info className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </span>
                  </label>
                  {metadata.description && (
                    <p id={descriptionId} className="sr-only">
                      {metadata.description}
                    </p>
                  )}
                  {!validation.isValid && validation.error && (
                    <p id={errorId} className="mt-1 text-xs text-red-600">
                      {validation.error}
                    </p>
                  )}
                </div>
              );
            }

            if (metadata.options && metadata.options.length > 0) {
              return (
                <div key={key}>
                  <label
                    htmlFor={inputId}
                    className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                  >
                    <span className="flex items-center gap-1.5">
                      {labelText}
                      {metadata.required && <span className="text-red-500">*</span>}
                      {metadata.description && (
                        <span
                          className="inline-flex h-4 w-4 cursor-help items-center justify-center text-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-500 dark:focus-visible:ring-offset-slate-900"
                          tabIndex={0}
                          role="img"
                          aria-label={metadata.description}
                          title={metadata.description}
                        >
                          <Info className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </span>
                  </label>
                  <select
                    id={inputId}
                    value={displayValue}
                    onChange={handleChange}
                    className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${baseValidationClasses}`}
                    aria-describedby={describedBy}
                    aria-invalid={!validation.isValid}
                  >
                    {!metadata.required && <option value="">Select an option</option>}
                    {metadata.options.map((option) => (
                      <option key={option.stringValue || option.label} value={option.stringValue}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {metadata.description && (
                    <p id={descriptionId} className="sr-only">
                      {metadata.description}
                    </p>
                  )}
                  {!validation.isValid && validation.error && (
                    <p id={errorId} className="mt-1 text-xs text-red-600">
                      {validation.error}
                    </p>
                  )}
                </div>
              );
            }

            let inputType = 'text';
            const inputProps = {};

            if (INTEGER_TYPES.has(metadata.type)) {
              inputType = 'number';
              inputProps.step = 1;
            } else if (NUMBER_TYPES.has(metadata.type)) {
              inputType = 'number';
              inputProps.step = 'any';
            } else if (DATE_TYPES.has(metadata.type)) {
              inputType = metadata.type;
            }

            if (metadata.min !== undefined) {
              inputProps.min = metadata.min;
            }

            if (metadata.max !== undefined) {
              inputProps.max = metadata.max;
            }

            return (
              <div key={key}>
                <label
                  htmlFor={inputId}
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  <span className="flex items-center gap-1.5">
                    {labelText}
                    {metadata.required && <span className="text-red-500">*</span>}
                    {metadata.description && (
                      <span
                        className="inline-flex h-4 w-4 cursor-help items-center justify-center text-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-500 dark:focus-visible:ring-offset-slate-900"
                        tabIndex={0}
                        role="img"
                        aria-label={metadata.description}
                        title={metadata.description}
                      >
                        <Info className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                </label>
                <input
                  id={inputId}
                  type={inputType}
                  value={displayValue}
                  onChange={handleChange}
                  className={inputClassName}
                  placeholder={placeholder}
                  aria-describedby={describedBy}
                  aria-invalid={!validation.isValid}
                  {...inputProps}
                />
                {metadata.description && (
                  <p id={descriptionId} className="sr-only">
                    {metadata.description}
                  </p>
                )}
                {!validation.isValid && validation.error && (
                  <p id={errorId} className="mt-1 text-xs text-red-600">
                    {validation.error}
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">This crew does not require any inputs.</p>
        )}
      </div>
    </>
  );

  const resolvedContainerClassName =
    containerClassName === undefined
      ? 'rounded-lg border bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900'
      : containerClassName;

  if (!resolvedContainerClassName) {
    return content;
  }

  return <div className={resolvedContainerClassName}>{content}</div>;
};

export default CrewInputsForm;
