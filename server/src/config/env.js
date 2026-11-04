import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure dotenv is loaded before validation
// First check server root (.env inside server/), then fallback to default cwd
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Schema for environment configuration (Zod 4 compliant)
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'], {
      message: "NODE_ENV must be one of: 'development', 'test', 'production'"
    })
    .default('development'),

  PORT: z
    .coerce
    .number({ message: 'PORT must be a valid number' })
    .int({ message: 'PORT must be an integer' })
    .min(1, { message: 'PORT must be between 1 and 65535' })
    .max(65535, { message: 'PORT must be between 1 and 65535' })
    .default(4000),

  CLIENT_URL: z
    .string({ message: 'CLIENT_URL is required' })
    .trim()
    .min(1, { message: 'CLIENT_URL cannot be empty' })
    .url({ message: 'CLIENT_URL must be a valid URL (e.g. http://localhost:5173)' })
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'CLIENT_URL must use http or https protocol' }
    )
    .refine((val) => val !== '*', {
      message: 'CLIENT_URL cannot be a wildcard (*) when cookie credentials are enabled'
    })
});

/**
 * Validates an environment configuration source object against the Zod schema.
 * Throws a clean descriptive error without logging secret values.
 *
 * @param {Record<string, unknown>} source - Environment variables (defaults to process.env)
 * @returns {Readonly<z.infer<typeof envSchema> & { isProduction: boolean, isTest: boolean, isDevelopment: boolean }>}
 */
export function validateEnv(source = process.env) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const errorMessages = result.error.issues.map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return ` - [${field}]: ${issue.message}`;
    });

    const formattedError = `Environment configuration validation failed:\n${errorMessages.join('\n')}`;
    console.error(formattedError);
    throw new Error(formattedError);
  }

  const data = result.data;

  return Object.freeze({
    ...data,
    isProduction: data.NODE_ENV === 'production',
    isTest: data.NODE_ENV === 'test',
    isDevelopment: data.NODE_ENV === 'development'
  });
}

// Centralized validated configuration singleton
export const env = validateEnv();
