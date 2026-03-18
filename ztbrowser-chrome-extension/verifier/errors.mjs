export class AttestationError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}
