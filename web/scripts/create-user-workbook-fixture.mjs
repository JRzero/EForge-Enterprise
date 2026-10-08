import {readFile, writeFile} from 'node:fs/promises';
import {userWorkbook} from '../tests/helpers/user-workbook.ts';
const [output, input] = process.argv.slice(2);
if (!output || !input) throw new Error('Expected output workbook and input JSON paths.');
const {rows, headers} = JSON.parse(await readFile(input, 'utf8'));
if (!Array.isArray(rows) || !rows.every(row => Array.isArray(row) && row.length === 7 && row.every(value => typeof value === 'string'))) throw new Error('Expected seven string columns per user fixture row.');
if (headers !== undefined && (!Array.isArray(headers) || headers.length !== 7 || !headers.every(value => typeof value === 'string'))) throw new Error('Expected seven string headers for the user fixture.');
await writeFile(output, userWorkbook(rows, headers));
