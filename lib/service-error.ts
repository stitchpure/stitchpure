export class ServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "ServiceError";
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}
