import {earthDataDirName} from '@cosmos/frontend/src/data/earth/earth-data-files.js';
import {moonDataDirName} from '@cosmos/frontend/src/data/moon/moon-data-files.js';
import {skyDataDirName} from '@cosmos/frontend/src/data/sky/sky-data-files.js';
import {dirname, join} from 'node:path';

const monoRepoDirPath = dirname(dirname(dirname(import.meta.dirname)));
const frontendDirPath = join(monoRepoDirPath, 'packages', 'frontend');

export const earthDataOutputDirPath = join(frontendDirPath, 'www-static', earthDataDirName);
export const moonDataOutputDirPath = join(frontendDirPath, 'www-static', moonDataDirName);
export const skyDataOutputDirPath = join(frontendDirPath, 'www-static', skyDataDirName);
export const downloadsDirPath = join(monoRepoDirPath, '.not-committed', 'downloads');
