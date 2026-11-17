import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.KIOSCO_DB = ':memory:';
process.env.KIOSCO_RESPALDOS = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosco-test-'));