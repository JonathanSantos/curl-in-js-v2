# curl-in-js

Cole o **Copy as cURL** do navegador dentro de um template literal e a requisição acontece em JavaScript.

```js
import { curl } from 'curl-in-js';

const { data, status } = await curl`
  curl 'https://pokeapi.co/api/v2/pokemon/ditto' \
    -H 'Accept: application/json' \
    --compressed
`;

console.log(status, data.name); // 200 ditto
```

Sem dependências. Roda no Node 20+, Deno, Bun e no navegador.

## De onde vem este projeto

Este repositório é a versão refeita de um projeto meu de 2021: **[JonathanSantos-zz/curl-in-js](https://github.com/JonathanSantos-zz/curl-in-js)**, criado em 7 de abril de 2021 na minha conta antiga do GitHub. Eram 68 linhas, escritas em 13 minutos pelo editor web, com o axios e o Node 14.

Em novembro de 2026 voltei a ele com uma dinâmica diferente de "reescrever do zero". Pedi a uma IA (o Claude, pelo Claude Code) para ler o código antigo **como apreciadora** antes de mexer em qualquer coisa:

1. **Datar.** O que cada linha conta sobre a época em que foi escrita.
2. **Admirar.** O que o código já fazia bem e quais técnicas usava.
3. **Medir.** Rodar o original de verdade e anotar onde ele parava de funcionar, com evidência em vez de opinião.
4. **Refazer sem trocar a essência.** A mesma ideia, a mesma API, o mesmo estilo, com o que 2026 oferece.

O resultado tem três partes, todas neste repositório:

| Onde | O quê |
|---|---|
| [`original/`](original/) | O código de 2021, intacto. Os nove commits originais estão preservados no histórico do Git. |
| [`src/`](src/curl/), [`index.js`](index.js), [`test/`](test/) | A versão 2.0.0. |
| [`index.html`](index.html) | O relatório interativo: linha do tempo, o que admiro no original, os dois parsers rodando lado a lado na página. O resumo dele está [no fim deste README](#relatório). |

Todo código no relatório é exibido com o **[Jonacode](https://github.com/JonathanSantos/jonacode)**, o editor de código que escrevi cinco anos depois do curl-in-js. Um projeto meu de 2026 mostrando um projeto meu de 2021.

## Instalação

O pacote não está publicado no npm. Instale direto do GitHub:

```bash
npm install github:JonathanSantos/curl-in-js-v2
```

## Uso

### Colar e executar

```js
import { curl } from 'curl-in-js';

const result = await curl`
  curl 'https://api.exemplo.dev/pokemon' \
    -X 'POST' \
    -H 'Content-Type: application/json' \
    --data-raw '{"name":"ditto"}'
`;

result.data;    // JSON já convertido quando a resposta é JSON; texto nos outros casos
result.status;  // 201
result.ok;      // true para 2xx
result.headers; // { 'content-type': 'application/json', ... }
```

Respostas de erro (404, 500...) **não lançam exceção**: voltam como resultado, com o `status` para você decidir. Só uma falha de rede lança `CurlRequestError`.

### Interpolar valores

Cada `${valor}` entra como um argumento só, sem ser reinterpretado pelo parser. Aspas e espaços dentro do valor não quebram o comando nem injetam opções. Objetos viram JSON.

```js
const id = 132;
const token = process.env.API_TOKEN;
const changes = { name: 'ditto', moves: ['transform'] };

await curl`
  curl 'https://api.exemplo.dev/pokemon/${id}' \
    -X PATCH \
    -H ${`Authorization: Bearer ${token}`} \
    --json ${changes}
`;
```

### Só interpretar, sem enviar

```js
const request = curl.parse`curl -u jona:segredo api.exemplo.dev/ping -d ok=1`;
// {
//   url: 'http://api.exemplo.dev/ping',
//   method: 'POST',
//   headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic am9uYTpzZWdyZWRv' },
//   body: 'ok=1',
//   timeout: null,
//   ignored: []
// }
```

`parseCurl(string)` faz o mesmo a partir de uma string comum, e `curl('curl ...')` também aceita string.

### Trocar o transporte

```js
import { createCurl } from 'curl-in-js';

const curl = createCurl({
  fetch: async (url, options) => {
    console.log('→', options.method, url);
    return fetch(url, options);
  },
});
```

Qualquer função com a assinatura do `fetch` serve: um dublê nos testes, um fetch com retry, cache ou log.

## Opções do curl suportadas

| Opção | Efeito |
|---|---|
| `-X`, `--request` | Método |
| `-H`, `--header` | Cabeçalho. `Nome:` remove, `Nome;` envia vazio, como no curl |
| `-d`, `--data`, `--data-raw`, `--data-binary`, `--data-ascii` | Corpo. Vários são unidos com `&` |
| `--data-urlencode` | Corpo codificado (`nome=valor` ou só `valor`) |
| `--json` | Corpo + `Content-Type` e `Accept` de JSON |
| `-G`, `--get` | Leva os dados para a query string |
| `-I`, `--head` | Método `HEAD` |
| `-u`, `--user` | `Authorization: Basic ...` |
| `-A`, `-e`, `-b` | `User-Agent`, `Referer`, `Cookie` |
| `-m`, `--max-time` | Timeout, via `AbortSignal` |
| `--url` | URL explícita |

Também são entendidos: aspas simples e duplas, o `$'...'` que o Chrome usa quando o corpo tem apóstrofo, barra de continuação, opções agrupadas (`-sSL`), valor colado (`-XPOST`) e a forma `--opcao=valor`. Opções que não mudam a requisição aqui (`--compressed`, `-L`, `-s`, `-k`, `-o`...) e opções desconhecidas são listadas em `request.ignored`.

**Ainda não suportado:** `-F` (multipart) e corpo lido de arquivo (`-d @arquivo`) lançam `CurlSyntaxError`. O formato "Copy as cURL (cmd)" do Windows, com `^`, não é lido. Redirecionamentos são sempre seguidos. No navegador, o fetch descarta cabeçalhos reservados como `User-Agent` e `Referer`.

## O código original e o código novo

<details>
<summary><b>2021</b> · <code>original/src/curl/curl.js</code> e <code>utils.js</code> (68 linhas, completo)</summary>

```js
// curl.js
import axios from 'axios';
import { getURL, getHeaders, getBody, getMethod } from "./utils.js";

export const curl = async ([curlString]) => {
  const url = getURL(curlString);
  const headers = getHeaders(curlString);
  const body = getBody(curlString);
  const method = getMethod(curlString, !!body);

  return axios(url, { headers, body, method })
    .then((response) => ({ data: response.data, status: response.status }))
    .catch(({ response }) => ({ data: response.data, status: response.status }));
};
```

```js
// utils.js
const breakLines = (curlString = '') => curlString.split(/\s{2,}/g).map(line => line.trim());

export const getURL = (curlString) => {
  const lines = breakLines(curlString);
  const matchURL = (line) => line.startsWith('curl');
  const clearLineURL = (line) => line.replace(/^curl '?([^']*)'?$/, '$1');

  return lines
    .filter(matchURL)
    .map(clearLineURL)[0];
};

export const getHeaders = (curlString) => {
  const lines = breakLines(curlString);
  const matchHeader = (line) => line.startsWith('-H');
  const clearLineHeader = (line) => line.replace(/^-H '(.*)'$/, '$1');
  const splitLineHeader = (line) => line.split(': ');
  const createObjectHeader = ([key, value]) => ({ [key]: value });
  const reducerToObjectHeader = (header, line) => ({ ...header, ...createObjectHeader(line) });

  return lines
    .filter(matchHeader)
    .map(clearLineHeader)
    .map(splitLineHeader)
    .reduce(reducerToObjectHeader, {});
};

export const getBody = (curlString) => {
  const lines = breakLines(curlString);
  const matchBody = (line) => ['--data-raw'].some((value) => line.startsWith(value));
  const clearLineBody = (line) => line.replace(/^.*'(.*)'$/, '$1');
  const body = lines.filter(matchBody).map(clearLineBody)[0];

  return body ? JSON.parse(body) : null;
};

export const getMethod = (curlString, hasBody) => {
  const lines = breakLines(curlString);
  const matchMethod = (line) => line.startsWith('-X');
  const clearLineMethod = (line) => line.replace(/^-X '(.*)'$/, '$1');
  const normalizeLineMethood = (line) => line.toLowerCase();
  let method = 'get';

  const methodsSearched = lines.filter(matchMethod);

  if (methodsSearched && methodsSearched.length > 0) {
    method = methodsSearched.map(clearLineMethod).map(normalizeLineMethood)[0];
  } else {
    if (hasBody) {
      method = 'post';
    }
  }

  return method;
};
```

</details>

<details open>
<summary><b>2026</b> · a versão nova, arquivo por arquivo</summary>

| Arquivo | Linhas | Papel |
|---|---:|---|
| [`src/curl/curl.js`](src/curl/curl.js) | 105 | A tag `curl`, `createCurl` e a única chamada de rede |
| [`src/curl/tokenize.js`](src/curl/tokenize.js) | 141 | Quebra o comando em argumentos, como o shell faria |
| [`src/curl/options.js`](src/curl/options.js) | 119 | A tabela de opções: uma linha por opção do curl |
| [`src/curl/parse.js`](src/curl/parse.js) | 156 | Dos argumentos à requisição imutável |
| [`src/curl/utils.js`](src/curl/utils.js) | 35 | `getURL`, `getHeaders`, `getBody`, `getMethod`: a API de 2021, preservada |
| [`src/curl/errors.js`](src/curl/errors.js) | 18 | `CurlSyntaxError` e `CurlRequestError` |
| [`index.js`](index.js) | 5 | O ponto de entrada que o `"main"` de 2021 já prometia |

O coração da versão nova, para comparar com o de 2021:

```js
export const createCurl = ({ fetch = globalThis.fetch } = {}) => {
  const curl = async (strings, ...values) => {
    const request = parseCurl(toSegments(strings, values));
    const response = await fetch(request.url, toFetchOptions(request)).catch((cause) => {
      throw new CurlRequestError(request, cause);
    });

    return toResult(response);
  };

  curl.parse = (strings, ...values) => parseCurl(toSegments(strings, values));

  return curl;
};

export const curl = createCurl();
```

</details>

## Desenvolvimento

```bash
npm test
```

```bash
npm run example
```

```bash
npm run report
```

`npm test` roda 40 testes com `node:test`, sem internet (36 unitários e 4 de ponta a ponta contra um servidor HTTP local). `npm run example` executa o comando do teste de 2021 contra a PokéAPI. `npm run report` regenera o `index.html` a partir de [`report/template.html`](report/template.html), embutindo os arquivos reais do repositório.

Para reproduzir as medições do código de 2021:

```bash
cd original && npm install && cd .. && node report/probe-2021.js
```

---

# Relatório

> A versão completa e interativa está em [`index.html`](index.html): abra o arquivo no navegador para ver os trechos no Jonacode e os dois parsers rodando lado a lado.

## curl-in-js, cinco anos depois

| | |
|---|---|
| Nascimento | 7 de abril de 2021, 11:52 (horário de Brasília), uma quarta-feira |
| Idade em 10 nov 2026 | 5 anos, 7 meses e 3 dias |
| Commits | 9, todos pelo editor web do GitHub |
| Primeira versão | 13 minutos e 29 segundos entre o primeiro e o sétimo commit |
| Tamanho | 68 linhas em 2 arquivos, 1 dependência (axios) |

### Linha do tempo

| Quando | Commit |
|---|---|
| 7 abr 2021, 11:52:49 | Initial commit: o repositório e um README de duas linhas |
| +1 min | Add files via upload: `package.json` |
| +2 min | Create curl.js |
| +3 min | Create utils.js |
| +5 min | Create curl.test.js |
| +7 min | Update curl.js: aspas duplas viram simples no import |
| +13 min | Update package.json: o script de teste e o Node 14.15.1 |
| 9 abr 2021, 14:38:52 | Update curl.js: entra o `.catch` que devolve `{ data, status }` também nos erros |
| +15 s | Update utils.js: suporte a `-X` e URL sem aspas |
| *2.041 dias sem commits* | |
| 10 nov 2026 | Releitura, medição e a versão 2.0.0 |

As mensagens são as que o GitHub sugere no editor web: o código foi escrito em outro lugar e levado arquivo por arquivo. Os dois commits de 9 de abril mostram que o projeto foi usado de verdade, porque resolvem necessidades que só aparecem no uso: uma resposta de erro e um método diferente de GET e POST.

### O que o código conta sobre abril de 2021

| Vestígio | O que ele registra |
|---|---|
| `"node": "14.15.1"` | O Node 14 era o LTS da vez. A versão exata é a marca de quem fixou o ambiente que tinha na máquina naquele dia. |
| `"type": "module"` e `'./utils.js'` | Módulos ES nativos no Node ainda eram novidade, com a extensão obrigatória no import. |
| `console.log(await curl...)` | *Top-level await* tinha saído de trás da flag no Node 14.8, meses antes. |
| `import axios from 'axios'` | O Node não tinha `fetch`. Ele só chegaria no Node 18, um ano depois. |
| `sec-ch-ua: "Google Chrome";v="89"` | O comando do teste foi copiado de um Chrome 89, de março de 2021, a versão em que os *Client Hints* passaram a ser enviados por padrão. |
| `"test": "node src/curl/curl.test.js"` | O `node:test` também só viria no Node 18. O teste é um script que imprime o resultado e pede olho humano. |
| `pokemon/ditto` | A PokéAPI, onde uma geração aprendeu a consumir APIs. E o Ditto, o Pokémon que copia os outros, num projeto sobre copiar requisições. |

### O que admiro no original

**1. A interface é o formato que o navegador já escreve.** O melhor design de API foi não inventar uma. A tag `curl` usa a mesma técnica que styled-components e graphql-tag popularizaram, e que o zx, do Google, aplicou a comandos de shell naquele mesmo 2021. A assinatura `async ([curlString])` desestrutura o template direto no parâmetro.

**2. Um parser que cabe em uma expressão regular.**

```js
const breakLines = (curlString = '') => curlString.split(/\s{2,}/g).map(line => line.trim());
```

Dentro de um template literal, a barra invertida no fim da linha é uma continuação: o JavaScript apaga a barra e a quebra. Sobra a indentação que o DevTools coloca antes de cada `-H`, e "dois ou mais espaços" vira o separador entre argumentos. Resolver o problema com um `split` exige conhecer bem o formato do Chrome.

**3. Pipelines com nome em cada etapa.**

```js
return lines
  .filter(matchHeader)
  .map(clearLineHeader)
  .map(splitLineHeader)
  .reduce(reducerToObjectHeader, {});
```

Funções puras, estilo *point-free*, desestruturação no parâmetro, propriedade computada e um `reduce` que monta o objeto sem mutar nada. O `return` se lê como a descrição do algoritmo.

**4. Erro HTTP é resultado.** O `.then` e o `.catch` devolvem o mesmo formato, `{ data, status }`. Quem chama decide o que fazer com um 404, sem `try/catch`.

**5. A divisão em dois arquivos.** `utils.js` só transforma texto em dados; `curl.js` é o único que fala com a rede. É o *functional core, imperative shell*, já presente em 68 linhas. Foi essa separação que permitiu rodar o parser de 2021 dentro do relatório, no navegador, sem alterar uma linha.

**6. O método inferido.** Sem `-X`, um comando com corpo vira POST: a mesma regra do curl de verdade. E `normalizeLineMethood`, com dois "o", segue preservado em `original/`.

### O que o tempo revelou

O código de 2021 foi executado com o axios que o `package.json` pede (`^0.21.1`, que hoje resolve para 0.21.4) contra um servidor local que devolve o que recebe. O script é [`report/probe-2021.js`](report/probe-2021.js).

| Entrada | Em 2021 (medido) | Causa | Em 2026 |
|---|---|---|---|
| POST com `--data-raw '{"name":"Jona"}'` | O servidor recebe o corpo vazio | O axios espera `data`; o código passa `body`, que é o nome usado pelo fetch | O corpo chega inteiro |
| ``curl`… /users/${id} …` `` | `TypeError: Cannot read properties of undefined (reading 'data')` | `([curlString])` pega só o texto antes da primeira interpolação | Interpolação suportada |
| Servidor fora do ar | O mesmo `TypeError` | Sem resposta, o erro do axios não tem `response` para desestruturar | `CurlRequestError` com a causa |
| Comando em uma linha só | URL: o comando inteiro. Cabeçalhos: `{}` | O parser depende da indentação do DevTools | Tokenizer de shell |
| `-H 'X-Note: a: b'` | `{"X-Note":"a"}` | `split(': ')` descarta o que vem depois do segundo separador | Divide só no primeiro `:` |
| `-H 'X-Note: a  b'` (dois espaços) | `{"-H 'X-Note":"a"}` | Os dois espaços dentro do valor disparam o `split(/\s{2,}/)` | Aspas protegem o conteúdo |
| `--data-raw 'a=1&b=2'` | `SyntaxError: … is not valid JSON` | `JSON.parse` em todo corpo | O corpo é o texto exato |

O caso para o qual o original foi escrito, um GET colado do Chrome, funciona hoje como funcionava em 2021. A tabela mostra a fronteira do que foi testado na época: o teste único era um GET, então o envio do corpo nunca falhou na frente de ninguém.

### O que foi refeito

```
núcleo puro                                                              casca
curl`…${x}…` → segmentos → tokenize → argumentos → tabela de opções  →  fetch → { data, status, ok, headers }
                                        → rascunho → requisição imutável
```

- **Tokenizer de shell.** Aspas simples, aspas duplas, `$'…'` e barra de continuação. O comando pode vir em qualquer formatação.
- **Template lido cru.** Com `strings.raw`, um `\n` dentro de um corpo JSON chega ao parser como o shell entregaria, em vez de virar uma quebra de linha e invalidar o JSON.
- **Interpolação segura.** `${valor}` é um argumento só. Objetos viram JSON.
- **Mais do curl.** 15 opções com efeito e 14 reconhecidas e ignoradas, contra 3 em 2021.
- **fetch nativo.** O axios saiu; o projeto não tem dependências.
- **Falhas com nome.** `CurlSyntaxError` e `CurlRequestError`, com `cause`.
- **Testes que rodam sozinhos.** 40 testes, sem internet.

| | 2021 | 2026 |
|---|---|---|
| Dependências | 1 (axios 0.21) | 0 |
| Node | 14.15.1, exato | >= 20 |
| Código | 68 linhas em 2 arquivos | 579 linhas em 7 arquivos, com JSDoc |
| Testes | 1 script que precisa de internet | 40 testes, offline |
| Opções do curl | `-H`, `-X`, `--data-raw` | 15 com efeito, 14 reconhecidas e ignoradas |
| `"main": "index.js"` | apontava para um arquivo que não existia | existe |
| Onde roda | Node | Node, Deno, Bun, navegador |

### Padrões aplicados

| Padrão | Onde | O que resolve |
|---|---|---|
| **Functional core, imperative shell** | `tokenize.js`, `options.js` e `parse.js` são puros; só `curl.js` chama a rede | Leva adiante a divisão que o original já tinha. O parser é testável sem servidor e roda no navegador. |
| **Máquina de estados em tabela** (State) | `readers` em `tokenize.js` | Um leitor por contexto de aspas, em vez de um `if` gigante com flags. |
| **Tabela de estratégias** (Strategy + Registry) | `OPTION_TABLE` em `options.js` | Ensinar uma opção nova é acrescentar uma linha; o parser não muda. |
| **Reducers imutáveis** | Cada opção recebe um rascunho e devolve outro | O `reducerToObjectHeader` de 2021 promovido a arquitetura. |
| **Value Object** | A requisição de `parseCurl` é congelada | Pode ser inspecionada, logada e comparada sem risco de alteração. |
| **Factory com injeção de dependência** | `createCurl({ fetch })` | O transporte é um parâmetro: dublê nos testes, retry ou log em produção. |
| **Facade** | A tag `curl` | Uma função esconde quatro etapas. Quem usa vê o que via em 2021. |
| **Adapter** | `utils.js` e `toFetchOptions` | A API de 2021 segue existindo sobre o parser novo. |
| **Erros tipados com causa** | `errors.js` | "Comando malformado" e "rede caiu" se distinguem com `instanceof`. |
| **Early return** | Em todo o código novo | O `if/else` aninhado de `getMethod` virou três linhas. |

### O que ficou igual, de propósito

- O nome, a tag `` curl`…` `` e o retorno `{ data, status }`, inclusive para respostas de erro.
- A pasta `src/curl/` com `curl.js` e `utils.js`, e as funções `getURL`, `getHeaders`, `getBody` e `getMethod`. Um teste garante que elas devolvem para o comando de 2021 o mesmo que devolviam.
- O estilo: funções pequenas, puras, com nome, encadeadas.
- O Ditto. O comando do teste original virou [`examples/pokemon.js`](examples/pokemon.js) e respondeu `200` na PokéAPI em 10 de novembro de 2026, com os cabeçalhos do Chrome 89.
- O código de 2021, intacto, em [`original/`](original/).

---

Original: [JonathanSantos-zz/curl-in-js](https://github.com/JonathanSantos-zz/curl-in-js) (2021) · Código do relatório exibido com [Jonacode](https://github.com/JonathanSantos/jonacode) · Licença ISC
