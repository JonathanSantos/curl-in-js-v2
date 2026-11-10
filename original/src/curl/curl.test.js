import { curl } from './curl.js';

console.log(
  await curl`
    curl 'https://pokeapi.co/api/v2/pokemon/ditto' \
      -H 'sec-ch-ua: "Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"' \
      -H 'Referer: https://pokeapi.co/' \
      -H 'sec-ch-ua-mobile: ?0' \
      -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36' \
      --compressed
  `
);
