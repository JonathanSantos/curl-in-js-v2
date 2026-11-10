import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CurlRequestError, createCurl } from '../index.js';

/** Dublê de fetch: guarda as chamadas e responde o que o teste pedir. */
const fakeFetch = (respond = () => Response.json({ ok: true })) => {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, ...options });
    return respond(url, options);
  };
  return { fetch, calls };
};

test('monta a chamada do fetch a partir do template', async () => {
  const { fetch, calls } = fakeFetch();
  const curl = createCurl({ fetch });

  const result = await curl`
    curl 'https://a.dev/users' \
      -X 'PUT' \
      -H 'Content-Type: application/json' \
      --data-raw '{"name":"Jona"}'
  `;

  assert.deepEqual(result, { data: { ok: true }, status: 200, ok: true, headers: { 'content-type': 'application/json' } });
  assert.deepEqual(calls, [{
    url: 'https://a.dev/users',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: '{"name":"Jona"}',
    signal: undefined,
  }]);
});

test('regressão de 2021: o corpo é enviado de verdade', async () => {
  const { fetch, calls } = fakeFetch();
  await createCurl({ fetch })`curl https://a.dev --data-raw '{"a":1}'`;
  assert.equal(calls[0].body, '{"a":1}');
  assert.equal(calls[0].method, 'POST');
});

test('regressão de 2021: o comando continua depois de uma interpolação', async () => {
  const { fetch, calls } = fakeFetch();
  const id = 42;
  await createCurl({ fetch })`curl 'https://a.dev/users/${id}' -H 'X-Trace: abc'`;
  assert.equal(calls[0].url, 'https://a.dev/users/42');
  assert.deepEqual(calls[0].headers, { 'X-Trace': 'abc' });
});

test('valor interpolado é um argumento só, mesmo com aspas e espaços', async () => {
  const curl = createCurl({ fetch: fakeFetch().fetch });
  const token = `it's "odd" -H 'Injected: yes'`;
  const request = curl.parse`curl https://a.dev -H ${`Authorization: Bearer ${token}`}`;
  assert.deepEqual(request.headers, { Authorization: `Bearer ${token}` });
});

test('objeto interpolado vira JSON', () => {
  const curl = createCurl({ fetch: fakeFetch().fetch });
  const request = curl.parse`curl https://a.dev --json ${{ name: "D'Ávila", tags: ['a b'] }}`;
  assert.equal(request.body, `{"name":"D'Ávila","tags":["a b"]}`);
});

test('o template é lido cru: \\n dentro do corpo chega como o shell entregaria', () => {
  const curl = createCurl({ fetch: fakeFetch().fetch });
  const request = curl.parse`curl https://a.dev --data-raw '{"text":"a\nb"}'`;
  assert.deepEqual(JSON.parse(request.body), { text: 'a\nb' });
});

test('aceita string comum além de template', async () => {
  const { fetch, calls } = fakeFetch();
  await createCurl({ fetch })("curl 'https://a.dev/ping'");
  assert.equal(calls[0].url, 'https://a.dev/ping');
});

test('erro HTTP volta como resultado, com data e status (a essência de 2021)', async () => {
  const { fetch } = fakeFetch(() => Response.json({ error: 'not found' }, { status: 404 }));
  const result = await createCurl({ fetch })`curl https://a.dev/missing`;
  assert.equal(result.status, 404);
  assert.equal(result.ok, false);
  assert.deepEqual(result.data, { error: 'not found' });
});

test('resposta que não é JSON volta como texto; JSON inválido também', async () => {
  const text = fakeFetch(() => new Response('<h1>oi</h1>', { headers: { 'content-type': 'text/html' } }));
  assert.equal((await createCurl(text)`curl https://a.dev`).data, '<h1>oi</h1>');

  const broken = fakeFetch(() => new Response('{oops', { headers: { 'content-type': 'application/json' } }));
  assert.equal((await createCurl(broken)`curl https://a.dev`).data, '{oops');
});

test('regressão de 2021: falha de rede vira CurlRequestError com a causa', async () => {
  const cause = new TypeError('fetch failed');
  const curl = createCurl({ fetch: async () => { throw cause; } });

  await assert.rejects(curl`curl https://offline.dev`, (error) => {
    assert.ok(error instanceof CurlRequestError);
    assert.equal(error.cause, cause);
    assert.equal(error.request.url, 'https://offline.dev');
    return true;
  });
});

test('--max-time vira um AbortSignal', async () => {
  const { fetch, calls } = fakeFetch();
  await createCurl({ fetch })`curl -m 5 https://a.dev`;
  assert.ok(calls[0].signal instanceof AbortSignal);
});
