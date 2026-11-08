import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

register(pathToFileURL(path.resolve('client/src/tests/jsx-loader.mjs')));

