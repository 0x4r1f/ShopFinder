import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import esbuild from 'esbuild';

const clientSrcDir = path.resolve('client/src');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let relativePath = specifier.slice(2);
    let resolvedPath = path.resolve(clientSrcDir, relativePath);

    if (!fs.existsSync(resolvedPath)) {
      if (fs.existsSync(resolvedPath + '.js')) {
        resolvedPath = resolvedPath + '.js';
      } else if (fs.existsSync(resolvedPath + '.jsx')) {
        resolvedPath = resolvedPath + '.jsx';
      }
    }

    return {
      shortCircuit: true,
      url: pathToFileURL(resolvedPath).href,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default {};',
    };
  }

  if (url.endsWith('.jsx')) {
    const filePath = fileURLToPath(url);
    const raw = fs.readFileSync(filePath, 'utf8');
    const result = esbuild.transformSync(raw, {
      loader: 'jsx',
      format: 'esm',
      sourcefile: filePath,
    });
    return {
      format: 'module',
      shortCircuit: true,
      source: result.code,
    };
  }
  return nextLoad(url, context);
}
