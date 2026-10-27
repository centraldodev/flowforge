export const errorsSource = String.raw`export class GatewayError extends Error {
  constructor(code, message, status = 400, upstreamStatus) {
    super(message); this.code = code; this.status = status; this.upstreamStatus = upstreamStatus;
  }
}
export const fail = (code, message, status, upstreamStatus) => { throw new GatewayError(code, message, status, upstreamStatus); };
`;
