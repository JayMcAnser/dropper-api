

module.exports = class AccessError extends Error {
  constructor(message, status, ...args ) {
    super(message, args ); // (1)
    this.name = "AccessError"; // (2)
    this.status = status
  }
}
