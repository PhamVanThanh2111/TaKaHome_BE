export class ResponseCommon<T = unknown> {
  constructor(code: number, message: string, data?: T) {
    this.code = code;
    this.message = message;
    this.data = data;
  }
  code: number;
  message: string;
  data?: T;
}
