/** O comando cURL não pôde ser entendido (aspas abertas, URL ausente, opção sem valor...). */
export class CurlSyntaxError extends SyntaxError {
  name = 'CurlSyntaxError';
}

/** A requisição não chegou a ter resposta (DNS, conexão recusada, timeout...). */
export class CurlRequestError extends Error {
  name = 'CurlRequestError';

  /**
   * @param {import('./parse.js').CurlRequest} request
   * @param {unknown} cause
   */
  constructor(request, cause) {
    super(`${request.method} ${request.url} falhou sem resposta: ${cause?.message ?? cause}`, { cause });
    this.request = request;
  }
}
