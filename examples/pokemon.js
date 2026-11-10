// O mesmo comando que servia de teste em 2021, colado do DevTools do Chrome 89.
// Rode com: npm run example
import { curl } from '../index.js';

const { data, status } = await curl`
  curl 'https://pokeapi.co/api/v2/pokemon/ditto' \
    -H 'sec-ch-ua: "Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"' \
    -H 'Referer: https://pokeapi.co/' \
    -H 'sec-ch-ua-mobile: ?0' \
    -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36' \
    --compressed
`;

console.log(status, { id: data.id, name: data.name, abilities: data.abilities.map(({ ability }) => ability.name) });
