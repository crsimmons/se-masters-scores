import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + entry.name;
    assert(!['results', 'scripts', 'raw', '.git', 'node_modules'].includes(entry.name), 'Private directory in build: ' + path);
    if (entry.isDirectory()) await check(path);
    else {
      assert(!/\.(json|py|map)$/.test(path), 'Source/data file in build: ' + path);
      if (/\.(js|html)$/.test(path)) {
        const content = await readFile(path, 'utf8');
        assert(!content.includes('swimmers') && !content.includes('age_groups'), 'Raw results in build: ' + path);
      }
    }
  }
}
await check('dist');
console.log('Build verified: no raw JSON, result-processing scripts, or source maps.');
