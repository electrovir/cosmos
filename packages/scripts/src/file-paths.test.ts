import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {downloadsDirPath, earthDataOutputDirPath} from './file-paths.js';

describe('file paths', () => {
    it('resolves within the frontend package and repo root', () => {
        assert.isTrue(existsSync(dirname(earthDataOutputDirPath)));
        assert.isTrue(existsSync(dirname(dirname(downloadsDirPath))));
    });
});
