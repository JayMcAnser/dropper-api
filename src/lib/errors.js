/**
 * All the error classes to return the Error to the client
 */
// range for validation errors 400 - 499
const VALIDATION_ERROR_ID = 400;
const VALIDATION_REQUIRED = 401;
const VALIDATION_NUMERIC = 402;
const VALIDATION_DATE = 403;

const MESSAGE_TYPE  = {
  [VALIDATION_REQUIRED]: 'is required',
  [VALIDATION_NUMERIC]: 'should be numeric',
  [VALIDATION_DATE]: 'should be date (YYYY-MM-DD)'
}
const NOT_FOUND_ERROR_ID = 500;
const INVALID_REQUEST_ERROR_ID = 600;

class ApiError extends Error {

  constructor() {
    super();
    this.id = -1;
  }
  toObject() {
    return {
      id: this.id,
      stack: process.env.NODE_ENV !== 'production' ? this.stack.split('\n').map(x => x.trim()) : undefined
    }
  }
  toString() {
    return ''
  }
}

/**
 * error if the data does not match the specification
 */
class ValidationError extends ApiError {
  constructor(fieldName, typeId, detail, ...params) {
    super(...params);
    this.id = typeId;
    this.fieldName = fieldName;
    this.message = MESSAGE_TYPE[typeId];
    this.detail = detail;
  }

  toObject() {
    let result = super.toObject()
    result.title = this.message;
    result.source = { pointer: `/${this.fieldName}`};
    result.detail = this.detail;
    return result;
  }

  toString() {
    return `validation: ${this.fieldName} - ${this.message} - ${this.detail}`
  }
}

/**
 * error when data (related) wasn't found
 */
class NotFoundError extends ApiError {
  constructor(message, detail, ...params) {
    super(...params);
    this.id = NOT_FOUND_ERROR_ID;
    this.message = message;
    this.detail = detail;
  }

  toObject() {
    let result = super.toObject()
    result.title = this.message;
    result.detail = this.detail;
    return result;
  }

  toString() {
    return `not found: ${this.message} - ${this.detail}`
  }
}

class InvalidRequest extends ApiError {
  constructor(detail, ...params) {
    super(...params);
    this.id = NOT_FOUND_ERROR_ID;
    this.message = 'invalid request';
    this.detail = detail;
  }

  toObject() {
    let result = super.toObject()
    result.title = this.message;
    result.detail = this.detail;
    return result;
  }

  toString() {
    return `invalid request: ${this.message} - ${this.detail}`
  }

}


module.exports = {
  VALIDATION_ERROR_ID,
  VALIDATION_REQUIRED,
  VALIDATION_NUMERIC,
  VALIDATION_DATE,
  NOT_FOUND_ERROR_ID,

  ApiError,
  ValidationError,
  NotFoundError,
  InvalidRequest,
}
