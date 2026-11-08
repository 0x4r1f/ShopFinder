/**
 * ShopFinder — Zod Request Validation Middleware Factory
 *
 * Validates req.body against a provided Zod schema.
 * Returns HTTP 400 Bad Request with structured field error details on failure.
 * Replaces req.body with parsed and sanitized schema output to prevent mass assignment.
 */

/**
 * Creates an Express request handler validating req.body against schema.
 *
 * @param {import('zod').ZodSchema} schema - Zod validation schema
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || (issue.keys ? issue.keys.join(', ') : 'body'),
        message: issue.message,
      }));

      const primaryMessage = details.length > 0 ? details[0].message : 'Validation failed';

      return res.status(400).json({
        success: false,
        error: {
          message: primaryMessage,
          details,
        },
      });
    }

    // Replace req.body with parsed and sanitized data (stripping unexpected mass assignment fields)
    req.body = result.data;
    next();
  };
}

export default validate;

