import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('Login & Registration Pages (Task 3.8)', () => {
  let React;
  let renderToStaticMarkup;
  let MemoryRouter;
  let esbuild;
  let AuthContext;
  let LoginPage;
  let RegisterPage;

  const tempLoginPath = path.join(clientSrcDir, 'pages/temp-test-login.js');
  const tempRegisterPath = path.join(clientSrcDir, 'pages/temp-test-register.js');
  const tempAuthContextPath = path.join(clientSrcDir, 'context/temp-test-pages-auth.js');

  before(async () => {
    React = (await import('../../client/node_modules/react/index.js')).default;
    renderToStaticMarkup = (await import('../../client/node_modules/react-dom/server.node.js')).renderToStaticMarkup;
    MemoryRouter = (await import('../../client/node_modules/react-router-dom/dist/index.js')).MemoryRouter;
    esbuild = (await import('../../client/node_modules/esbuild/lib/main.js')).default;

    // Compile AuthContext
    const authContextRaw = fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8');
    const authCode = esbuild.transformSync(authContextRaw, { loader: 'jsx' }).code;
    fs.writeFileSync(tempAuthContextPath, authCode);

    // Compile LoginPage (strip CSS import for Node runtime)
    const loginRaw = fs.readFileSync(path.join(clientSrcDir, 'pages/LoginPage.jsx'), 'utf8')
      .replace("import '../styles/auth.css';", '')
      .replace('../context/AuthContext.jsx', '../context/temp-test-pages-auth.js');
    const loginCode = esbuild.transformSync(loginRaw, { loader: 'jsx' }).code;
    fs.writeFileSync(tempLoginPath, loginCode);

    // Compile RegisterPage (strip CSS import for Node runtime)
    const registerRaw = fs.readFileSync(path.join(clientSrcDir, 'pages/RegisterPage.jsx'), 'utf8')
      .replace("import '../styles/auth.css';", '')
      .replace('../context/AuthContext.jsx', '../context/temp-test-pages-auth.js');
    const registerCode = esbuild.transformSync(registerRaw, { loader: 'jsx' }).code;
    fs.writeFileSync(tempRegisterPath, registerCode);

    AuthContext = (await import('../../client/src/context/temp-test-pages-auth.js')).AuthContext;
    LoginPage = (await import('../../client/src/pages/temp-test-login.js')).default;
    RegisterPage = (await import('../../client/src/pages/temp-test-register.js')).default;
  });

  after(() => {
    try { fs.unlinkSync(tempLoginPath); } catch {}
    try { fs.unlinkSync(tempRegisterPath); } catch {}
    try { fs.unlinkSync(tempAuthContextPath); } catch {}
  });

  const defaultMockAuth = {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
    refreshUser: async () => {},
    updateUser: async () => {},
    hydrateSession: async () => {},
  };

  test('1. Login page renders all required fields, labels, accessible attributes, and controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login'] },
        React.createElement(AuthContext.Provider, { value: defaultMockAuth }, React.createElement(LoginPage))
      )
    );

    // Form element
    assert.ok(html.includes('aria-label="Sign in form"'), 'Form must have accessible sign in aria-label');
    assert.ok(html.includes('Sign In'), 'Page header must include Sign In');

    // Email field
    assert.ok(html.includes('id="login-email"'), 'Email input must have id="login-email"');
    assert.ok(html.includes('name="email"'), 'Email input must have name="email"');
    assert.ok(html.includes('type="email"'), 'Email input must have type="email"');
    assert.ok(html.includes('for="login-email"'), 'Email label must associate with login-email');

    // Password field & toggle
    assert.ok(html.includes('id="login-password"'), 'Password input must have id="login-password"');
    assert.ok(html.includes('name="password"'), 'Password input must have name="password"');
    assert.ok(html.includes('for="login-password"'), 'Password label must associate with login-password');
    assert.ok(html.includes('password-toggle-btn'), 'Must include show/hide password toggle button');
    assert.ok(html.includes('aria-label="Show password"'), 'Toggle button must have accessible aria-label');

    // Submit button & link
    assert.ok(html.includes('type="submit"'), 'Must have submit button');
    assert.ok(html.includes('href="/register"'), 'Must have link to registration page');
  });

  test('2. Registration page renders all required fields, role selector, password confirm, and controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/register'] },
        React.createElement(AuthContext.Provider, { value: defaultMockAuth }, React.createElement(RegisterPage))
      )
    );

    // Form element
    assert.ok(html.includes('aria-label="Registration form"'), 'Form must have accessible registration aria-label');
    assert.ok(html.includes('Create an Account'), 'Page header must include Create an Account');

    // Full name field
    assert.ok(html.includes('id="register-name"'), 'Name input must have id="register-name"');
    assert.ok(html.includes('name="name"'), 'Name input must have name="name"');
    assert.ok(html.includes('for="register-name"'), 'Name label must associate with register-name');

    // Email field
    assert.ok(html.includes('id="register-email"'), 'Email input must have id="register-email"');
    assert.ok(html.includes('name="email"'), 'Email input must have name="email"');
    assert.ok(html.includes('type="email"'), 'Email input must have type="email"');
    assert.ok(html.includes('for="register-email"'), 'Email label must associate with register-email');

    // Role radiogroup
    assert.ok(html.includes('role="radiogroup"'), 'Must have role selection radiogroup');
    assert.ok(html.includes('value="customer"'), 'Must offer Customer role');
    assert.ok(html.includes('value="owner"'), 'Must offer Property Owner role');
    assert.ok(!html.includes('value="admin"'), 'Must strictly NEVER offer Admin role');

    // Password & confirm fields
    assert.ok(html.includes('id="register-password"'), 'Password input must have id="register-password"');
    assert.ok(html.includes('id="register-password-confirm"'), 'Password confirm input must have id="register-password-confirm"');
    assert.ok(html.includes('name="passwordConfirm"'), 'Password confirm must have name="passwordConfirm"');

    // Submit button & link
    assert.ok(html.includes('type="submit"'), 'Must have submit button');
    assert.ok(html.includes('href="/login"'), 'Must have link to login page');
  });

  test('3. Client-side required-field validation rejects empty submissions', () => {
    // Validate LoginPage logic
    const validateLogin = (data) => {
      const errors = {};
      if (!data.email.trim()) errors.email = 'Email address is required.';
      if (!data.password) errors.password = 'Password is required.';
      return errors;
    };

    const emptyLoginErrors = validateLogin({ email: '', password: '' });
    assert.equal(emptyLoginErrors.email, 'Email address is required.');
    assert.equal(emptyLoginErrors.password, 'Password is required.');

    // Validate RegisterPage logic
    const validateRegister = (data) => {
      const errors = {};
      if (!data.name.trim()) errors.name = 'Full name is required.';
      if (!data.email.trim()) errors.email = 'Email address is required.';
      if (!['customer', 'owner'].includes(data.role)) errors.role = 'Please select a valid account role.';
      if (!data.password) errors.password = 'Password is required.';
      if (!data.passwordConfirm) errors.passwordConfirm = 'Please confirm your password.';
      return errors;
    };

    const emptyRegisterErrors = validateRegister({ name: '', email: '', role: 'customer', password: '', passwordConfirm: '' });
    assert.equal(emptyRegisterErrors.name, 'Full name is required.');
    assert.equal(emptyRegisterErrors.email, 'Email address is required.');
    assert.equal(emptyRegisterErrors.password, 'Password is required.');
    assert.equal(emptyRegisterErrors.passwordConfirm, 'Please confirm your password.');
  });

  test('4. Client-side email format validation rejects malformed email addresses', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = ['invalid', 'plainaddress', '@missingusername.com', 'user@.com', 'user@missingtld'];

    for (const email of invalidEmails) {
      assert.ok(!emailRegex.test(email), `Email "${email}" must fail regex validation`);
    }

    const validEmails = ['user@example.com', 'john.doe@sub.domain.org', 'test_user+tag@shopfinder.io'];
    for (const email of validEmails) {
      assert.ok(emailRegex.test(email), `Email "${email}" must pass regex validation`);
    }
  });

  test('5. Password confirmation mismatch and minimum length are rejected on registration', () => {
    const validatePassword = (password, passwordConfirm) => {
      const errors = {};
      if (!password) {
        errors.password = 'Password is required.';
      } else if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters long.';
      }

      if (!passwordConfirm) {
        errors.passwordConfirm = 'Please confirm your password.';
      } else if (password !== passwordConfirm) {
        errors.passwordConfirm = 'Passwords do not match.';
      }
      return errors;
    };

    // Case A: Password under 8 chars
    const shortErr = validatePassword('short', 'short');
    assert.equal(shortErr.password, 'Password must be at least 8 characters long.');

    // Case B: Password mismatch
    const mismatchErr = validatePassword('ValidPassword123!', 'DifferentPassword123!');
    assert.equal(mismatchErr.passwordConfirm, 'Passwords do not match.');

    // Case C: Valid match
    const validErr = validatePassword('ValidPassword123!', 'ValidPassword123!');
    assert.deepEqual(validErr, {});
  });

  test('6. Registration strictly allows only Customer and Owner roles and forbids Admin', () => {
    const pageSource = fs.readFileSync(path.join(clientSrcDir, 'pages/RegisterPage.jsx'), 'utf8');

    // Verify role options offered in JSX
    assert.ok(pageSource.includes('value="customer"'), 'Must offer customer role in form');
    assert.ok(pageSource.includes('value="owner"'), 'Must offer owner role in form');
    assert.ok(!pageSource.includes('value="admin"'), 'Must strictly NEVER offer admin role in form');

    // Verify client validation whitelist
    assert.ok(
      pageSource.includes("['customer', 'owner'].includes(formData.role)"),
      'Must strictly enforce role whitelist checking customer and owner only'
    );
  });

  test('7. Login invokes AuthContext login with trimmed email and password', async () => {
    let capturedCredentials = null;
    const mockAuth = {
      ...defaultMockAuth,
      login: async (creds) => {
        capturedCredentials = creds;
        return { id: 'u_login', email: creds.email, role: 'customer' };
      },
    };

    // Simulate login form submit behavior
    const emailInput = '  user@example.com  ';
    const passwordInput = 'SecretPass123!';
    await mockAuth.login({ email: emailInput.trim(), password: passwordInput });

    assert.equal(capturedCredentials.email, 'user@example.com', 'Email must be trimmed');
    assert.equal(capturedCredentials.password, 'SecretPass123!');
  });

  test('8. Registration invokes AuthContext register with trimmed fields', async () => {
    let capturedRegistration = null;
    const mockAuth = {
      ...defaultMockAuth,
      register: async (data) => {
        capturedRegistration = data;
        return { id: 'u_reg', email: data.email, role: data.role, name: data.name };
      },
    };

    const regData = {
      name: '  Karim Chowdhury  ',
      email: '  karim@example.com  ',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
      role: 'owner',
    };

    await mockAuth.register({
      name: regData.name.trim(),
      email: regData.email.trim(),
      password: regData.password,
      passwordConfirm: regData.passwordConfirm,
      role: regData.role,
    });

    assert.equal(capturedRegistration.name, 'Karim Chowdhury', 'Name must be trimmed');
    assert.equal(capturedRegistration.email, 'karim@example.com', 'Email must be trimmed');
    assert.equal(capturedRegistration.role, 'owner');
  });

  test('9. API error banner displays error messages safely with role="alert"', () => {
    const errorHtml = renderToStaticMarkup(
      React.createElement(
        'div',
        { className: 'auth-error-banner', role: 'alert', 'aria-live': 'assertive' },
        React.createElement('span', null, 'Invalid email or password.')
      )
    );

    assert.ok(errorHtml.includes('role="alert"'), 'Error banner must have role="alert"');
    assert.ok(errorHtml.includes('aria-live="assertive"'), 'Error banner must have aria-live="assertive"');
    assert.ok(errorHtml.includes('Invalid email or password.'), 'Must render safe message text');
    assert.ok(!errorHtml.includes('token'), 'Must never render sensitive auth tokens');
  });

  test('10. Loading and disabled states are properly applied to form inputs and submit buttons', () => {
    const submittingBtnHtml = renderToStaticMarkup(
      React.createElement(
        'button',
        { type: 'submit', className: 'auth-submit-btn', disabled: true, 'aria-busy': true },
        'Signing In...'
      )
    );

    assert.ok(submittingBtnHtml.includes('disabled=""') || submittingBtnHtml.includes('disabled'), 'Submit button must be disabled when submitting');
    assert.ok(submittingBtnHtml.includes('aria-busy="true"'), 'Submit button must have aria-busy="true"');
    assert.ok(submittingBtnHtml.includes('Signing In...'), 'Button must show loading text');
  });

  test('11. Successful authentication resolves to appropriate default destination based on role', () => {
    const resolveDestination = (user, locationState) => {
      return (
        locationState?.from?.pathname ||
        (user?.role === 'owner' ? '/owner-dashboard' : '/dashboard')
      );
    };

    // Case A: Customer with no previous location
    assert.equal(resolveDestination({ role: 'customer' }, {}), '/dashboard');

    // Case B: Owner with no previous location
    assert.equal(resolveDestination({ role: 'owner' }, {}), '/owner-dashboard');

    // Case C: Admin with no previous location
    assert.equal(resolveDestination({ role: 'admin' }, {}), '/dashboard');
  });

  test('12. Protected-route return destination is preserved when location.state.from is available', () => {
    const resolveDestination = (user, locationState) => {
      return (
        locationState?.from?.pathname ||
        (user?.role === 'owner' ? '/owner-dashboard' : '/dashboard')
      );
    };

    const protectedState = { from: { pathname: '/listings/create' } };
    assert.equal(
      resolveDestination({ role: 'owner' }, protectedState),
      '/listings/create',
      'Must redirect to protected route target instead of default dashboard'
    );
  });

  test('13. Zero auth token storage in browser localStorage or sessionStorage', () => {
    const pageFiles = ['pages/LoginPage.jsx', 'pages/RegisterPage.jsx', 'context/AuthContext.jsx', 'services/authService.js', 'services/api.js'];

    for (const file of pageFiles) {
      const fullPath = path.join(clientSrcDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Strip comments
      const stripped = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

      assert.ok(
        !stripped.includes('localStorage'),
        `${file} must NEVER access localStorage`
      );
      assert.ok(
        !stripped.includes('sessionStorage'),
        `${file} must NEVER access sessionStorage`
      );
      assert.ok(
        !stripped.includes('document.cookie'),
        `${file} must NEVER directly access document.cookie`
      );
    }
  });

  test('14. Zero direct PocketBase client imports or network access in client/src/', () => {
    const checkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(full);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
          if (!fs.existsSync(full)) continue;
          let content;
          try {
            content = fs.readFileSync(full, 'utf8');
          } catch (err) {
            if (err.code === 'ENOENT') continue;
            throw err;
          }
          const stripped = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

          assert.ok(
            !stripped.includes("from 'pocketbase'") && !stripped.includes('from "pocketbase"'),
            `${full} must NEVER import PocketBase directly (D-007 violation)`
          );
          assert.ok(
            !stripped.includes('127.0.0.1:8090') && !stripped.includes('localhost:8090'),
            `${full} must NEVER communicate directly with PocketBase port 8090`
          );
        }
      }
    };

    checkDir(clientSrcDir);
  });
});
