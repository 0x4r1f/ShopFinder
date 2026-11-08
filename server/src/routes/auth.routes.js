import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

/**
 * Authentication Endpoints (Phase 3, Task 3.2)
 *
 * Base path: /api/v1/auth
 *
 * All state-changing endpoints (POST) inherit Origin/Referer CSRF protection
 * via csrfProtect middleware mounted globally in app.js.
 */

// POST /api/v1/auth/register — Public customer and owner registration
router.post('/register', validate(registerSchema), authController.register);

// POST /api/v1/auth/login — User authentication returning sanitized profile
router.post('/login', validate(loginSchema), authController.login);

// POST /api/v1/auth/logout — User session teardown foundation
router.post('/logout', authController.logout);

export default router;

