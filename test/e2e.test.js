import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { CurlRequestError, curl } from '../index.js';

// Fluxo principal de ponta a ponta: o `curl` de verdade, o fetch de verdade e
// um servidor HTTP local que devolve o que recebeu.
let server;
let origin;

before(async () => {
  server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);

    if (request.url === '/teapot') {
      response.writeHead(418, { 'content-type': 'application/json' }).end('{"error":"teapot"}');
      return;
    }

    const echo = { method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString() };
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(echo));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('GET com cabeçalhos colados do DevTools', async () => {
  const { data, status, ok } = await curl`
    curl '${origin}/api/v2/pokemon/ditto' \
      -H 'sec-ch-ua: "Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"' \
      -H 'Referer: https://pokeapi.co/' \
      -H 'sec-ch-ua-mobile: ?0' \
      --compressed
  `;

  assert.equal(status, 200);
  assert.equal(ok, true);
  assert.equal(data.method, 'GET');
  assert.equal(data.url, '/api/v2/pokemon/ditto');
  assert.equal(data.headers['sec-ch-ua'], '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"');
  assert.equal(data.headers.referer, 'https://pokeapi.co/');
});

test('POST com corpo JSON chega inteiro ao servidor', async () => {
  const pokemon = { name: 'ditto', moves: ['transform'] };
  const { data } = await curl`
    curl '${origin}/pokemon' \
      -H 'Content-Type: application/json' \
      --data-raw ${pokemon}
  `;

  assert.equal(data.method, 'POST');
  assert.equal(data.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(data.body), pokemon);
});

test('status de erro volta como resultado', async () => {
  const result = await curl`curl ${origin}/teapot`;
  assert.deepEqual({ data: result.data, status: result.status, ok: result.ok }, { data: { error: 'teapot' }, status: 418, ok: false });
});

test('servidor fora do ar lança CurlRequestError', async () => {
  await assert.rejects(curl`curl http://127.0.0.1:1/`, CurlRequestError);
});
