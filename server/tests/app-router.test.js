import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('React Router Layout Hierarchy & AppRouter (Task 4.3)', () => {
  let React;
  let renderToStaticMarkup;
  let MemoryRouter;
  let esbuild;
  let AuthContext;
  let AppRouter;

  const tempAuthPath = path.join(clientSrcDir, 'context/temp-test-router-auth.js');
  const tempRouterPath = path.join(clientSrcDir, 'routes/temp-test-app-router.js');

  before(async () => {
    React = (await import('../../client/node_modules/react/index.js')).default;
    renderToStaticMarkup = (await import('../../client/node_modules/react-dom/server.node.js')).renderToStaticMarkup;
    MemoryRouter = (await import('../../client/node_modules/react-router-dom/dist/index.js')).MemoryRouter;
    esbuild = (await import('../../client/node_modules/esbuild/lib/main.js')).default;

    // Compile AuthContext to a temporary ESM file so both test runner and bundled AppRouter share the same context identity
    const authRaw = fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8');
    const authCode = esbuild.transformSync(authRaw, { loader: 'jsx' }).code;
    fs.writeFileSync(tempAuthPath, authCode);

    // Bundle AppRouter with esbuild, keeping React/React Router external and aliasing AuthContext
    await esbuild.build({
      entryPoints: [path.join(clientSrcDir, 'routes/AppRouter.jsx')],
      bundle: true,
      format: 'esm',
      outfile: tempRouterPath,
      external: ['react', 'react-dom', 'react-router-dom'],
      loader: { '.css': 'empty' },
      plugins: [
        {
          name: 'alias-auth-context',
          setup(build) {
            build.onResolve({ filter: /AuthContext\.jsx$/ }, () => {
              return { path: '../context/temp-test-router-auth.js', external: true };
            });
          },
        },
      ],
    });

    AuthContext = (await import(pathToFileURL(tempAuthPath).href)).AuthContext;
    AppRouter = (await import(pathToFileURL(tempRouterPath).href)).default;
  });

  after(() => {
    try {
      fs.unlinkSync(tempAuthPath);
    } catch {}
    try {
      fs.unlinkSync(tempRouterPath);
    } catch {}
  });

  // Helper to render AppRouter in MemoryRouter at a specific route and auth state
  function renderWithRouter(route, authState = { loading: false, user: null, isAuthenticated: false, error: null }) {
    // Suppress React Router useLayoutEffect SSR warning during node testing
    const originalError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
        return;
      }
      originalError(...args);
    };

    try {
      return renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          { initialEntries: [route] },
          React.createElement(
            AuthContext.Provider,
            { value: authState },
            React.createElement(AppRouter)
          )
        )
      );
    } finally {
      console.error = originalError;
    }
  }

  test('1. Route "/" renders HomePage within MainLayout with semantic header, main, and footer', () => {
    const html = renderWithRouter('/');
    // Layout elements from MainLayout
    assert.ok(html.includes('<header'), 'MainLayout must contain <header>');
    assert.ok(html.includes('ShopFinder'), 'MainLayout header must contain brand name');
    assert.ok(html.includes('<main'), 'MainLayout must contain <main>');
    assert.ok(html.includes('<footer'), 'MainLayout must contain <footer>');
    // Content rendered inside <Outlet /> from HomePage
    assert.ok(html.includes('Commercial Property Marketplace &amp; SaaS'), 'HomePage content must be rendered via <Outlet />');
    assert.ok(html.includes('Go to Login'), 'HomePage unauthenticated status links must be rendered');
  });

  test('2. Route "/login" renders LoginPage within AuthLayout', () => {
    const html = renderWithRouter('/login');
    // Layout elements from AuthLayout (centered container without MainLayout header/footer)
    assert.ok(!html.includes('border-b border-border bg-card'), 'AuthLayout must not render main header');
    assert.ok(!html.includes('border-t border-border bg-card'), 'AuthLayout must not render main footer');
    assert.ok(html.includes('<main class="w-full">'), 'AuthLayout container must wrap content');
    // Content from LoginPage
    assert.ok(html.includes('<h1>Sign In</h1>'), 'LoginPage heading must be rendered');
    assert.ok(html.includes('name="email"'), 'Email input must exist');
    assert.ok(html.includes('name="password"'), 'Password input must exist');
  });

  test('3. Route "/register" renders RegisterPage within AuthLayout', () => {
    const html = renderWithRouter('/register');
    // Layout elements from AuthLayout
    assert.ok(!html.includes('border-b border-border bg-card'), 'AuthLayout must not render main header');
    assert.ok(!html.includes('border-t border-border bg-card'), 'AuthLayout must not render main footer');
    assert.ok(html.includes('<main class="w-full">'), 'AuthLayout container must wrap content');
    // Content from RegisterPage
    assert.ok(html.includes('<h1>Create an Account</h1>'), 'RegisterPage heading must be rendered');
    assert.ok(html.includes('name="name"'), 'Name input must exist');
    assert.ok(html.includes('name="role"'), 'Role select must exist');
  });

  test('4. Route "/dashboard" is accessible to authenticated customer within DashboardLayout', () => {
    const customerUser = { id: 'cust-1', name: 'Alice Customer', email: 'alice@example.com', role: 'customer' };
    const html = renderWithRouter('/dashboard', {
      loading: false,
      user: customerUser,
      isAuthenticated: true,
      error: null,
    });

    // Layout elements from DashboardLayout
    assert.ok(html.includes('max-w-7xl mx-auto w-full'), 'DashboardLayout container must wrap content');
    // Content from DashboardPage
    assert.ok(html.includes('Customer Dashboard (Protected)'), 'Customer Dashboard heading must render');
    assert.ok(html.includes('Welcome, Alice Customer!'), 'Customer greeting must render');
    assert.ok(html.includes('Role: customer'), 'Customer role must display');
  });

  test('5. Route "/dashboard" blocks unauthenticated users', () => {
    const html = renderWithRouter('/dashboard', {
      loading: false,
      user: null,
      isAuthenticated: false,
      error: null,
    });

    // Unauthenticated user should not see protected customer content
    assert.ok(!html.includes('Customer Dashboard (Protected)'), 'Unauthenticated user must not access customer dashboard');
    // ProtectedRoute renders Navigate (rendered as empty static markup in server render)
    assert.ok(!html.includes('Welcome,'), 'Greeting must not render');
  });

  test('6. Route "/dashboard" blocks authenticated owner with Access Denied', () => {
    const ownerUser = { id: 'own-1', name: 'Bob Owner', email: 'bob@example.com', role: 'owner' };
    const html = renderWithRouter('/dashboard', {
      loading: false,
      user: ownerUser,
      isAuthenticated: true,
      error: null,
    });

    assert.ok(!html.includes('Customer Dashboard (Protected)'), 'Owner must not access customer dashboard');
    assert.ok(html.includes('Access Denied'), 'Owner must see Access Denied on customer dashboard');
    assert.ok(html.includes('You do not have permission to access this page.'), 'Permission message must render');
  });

  test('7. Route "/owner-dashboard" is accessible to authenticated owner within DashboardLayout', () => {
    const ownerUser = { id: 'own-1', name: 'Bob Owner', email: 'bob@example.com', role: 'owner' };
    const html = renderWithRouter('/owner-dashboard', {
      loading: false,
      user: ownerUser,
      isAuthenticated: true,
      error: null,
    });

    // Layout elements from DashboardLayout
    assert.ok(html.includes('max-w-7xl mx-auto w-full'), 'DashboardLayout container must wrap content');
    // Content from OwnerDashboardPage
    assert.ok(html.includes('Owner Portal (Role-Protected: Owner/Admin)'), 'Owner Portal heading must render');
    assert.ok(html.includes('Welcome to the Owner Portal, Bob Owner!'), 'Owner greeting must render');
    assert.ok(html.includes('Verified Role: owner'), 'Verified role must display');
  });

  test('8. Route "/owner-dashboard" is accessible to authenticated admin within DashboardLayout', () => {
    const adminUser = { id: 'admin-1', name: 'Carol Admin', email: 'carol@example.com', role: 'admin' };
    const html = renderWithRouter('/owner-dashboard', {
      loading: false,
      user: adminUser,
      isAuthenticated: true,
      error: null,
    });

    // Layout elements from DashboardLayout
    assert.ok(html.includes('max-w-7xl mx-auto w-full'), 'DashboardLayout container must wrap content');
    // Content from OwnerDashboardPage
    assert.ok(html.includes('Owner Portal (Role-Protected: Owner/Admin)'), 'Owner Portal heading must render for admin');
    assert.ok(html.includes('Welcome to the Owner Portal, Carol Admin!'), 'Admin greeting must render');
    assert.ok(html.includes('Verified Role: admin'), 'Admin verified role must display');
  });

  test('9. Route "/owner-dashboard" blocks authenticated customer with Access Denied', () => {
    const customerUser = { id: 'cust-1', name: 'Alice Customer', email: 'alice@example.com', role: 'customer' };
    const html = renderWithRouter('/owner-dashboard', {
      loading: false,
      user: customerUser,
      isAuthenticated: true,
      error: null,
    });

    assert.ok(!html.includes('Owner Portal (Role-Protected: Owner/Admin)'), 'Customer must not access owner portal');
    assert.ok(html.includes('Access Denied'), 'Customer must see Access Denied on owner portal');
    assert.ok(html.includes('You do not have permission to access this page.'), 'Permission message must render');
  });

  test('10. Route "/owner-dashboard" blocks unauthenticated users', () => {
    const html = renderWithRouter('/owner-dashboard', {
      loading: false,
      user: null,
      isAuthenticated: false,
      error: null,
    });

    assert.ok(!html.includes('Owner Portal (Role-Protected: Owner/Admin)'), 'Unauthenticated user must not access owner portal');
    assert.ok(!html.includes('Welcome to the Owner Portal'), 'Greeting must not render');
  });

  test('11. Route "*" (unknown/arbitrary path) renders NotFoundPage', () => {
    const testPaths = ['/non-existent-page', '/api/secret-route', '/dashboard/invalid-subpath'];
    for (const testPath of testPaths) {
      const html = renderWithRouter(testPath);
      assert.ok(html.includes('404 — Page Not Found'), `Path "${testPath}" must render 404 page`);
      assert.ok(html.includes('The page you are looking for does not exist or has been moved.'), `Path "${testPath}" must render not found description`);
      assert.ok(html.includes('Back to Home'), `Path "${testPath}" must include link back to home`);
    }
  });

  test('12. Session hydration loading state suppresses protected content until resolved', () => {
    // Both /dashboard and /owner-dashboard while loading=true
    const customerLoadingHtml = renderWithRouter('/dashboard', {
      loading: true,
      user: null,
      isAuthenticated: false,
      error: null,
    });
    assert.ok(customerLoadingHtml.includes('Loading session...'), 'Hydrating session must display loading indicator');
    assert.ok(!customerLoadingHtml.includes('Customer Dashboard (Protected)'), 'Hydrating session must not flash customer dashboard');

    const ownerLoadingHtml = renderWithRouter('/owner-dashboard', {
      loading: true,
      user: null,
      isAuthenticated: false,
      error: null,
    });
    assert.ok(ownerLoadingHtml.includes('Loading session...'), 'Hydrating session must display loading indicator');
    assert.ok(!ownerLoadingHtml.includes('Owner Portal (Role-Protected: Owner/Admin)'), 'Hydrating session must not flash owner portal');
  });

  test('13. Layout shells render <Outlet /> allowing child route content to be displayed', () => {
    // Verify MainLayout structure
    const mainHtml = renderWithRouter('/');
    assert.ok(mainHtml.includes('<header'), 'MainLayout must render header wrapper');
    assert.ok(mainHtml.includes('<main class="flex-1">'), 'MainLayout must render main outlet wrapper');
    assert.ok(mainHtml.includes('<footer'), 'MainLayout must render footer wrapper');
    assert.ok(mainHtml.includes('ShopFinder'), 'MainLayout header branding must render');
    assert.ok(mainHtml.includes('Commercial Property Marketplace &amp; SaaS'), 'MainLayout Outlet must render child page');

    // Verify AuthLayout structure
    const authHtml = renderWithRouter('/login');
    assert.ok(authHtml.includes('<main class="w-full">'), 'AuthLayout must render main outlet wrapper');
    assert.ok(authHtml.includes('<h1>Sign In</h1>'), 'AuthLayout Outlet must render child page');

    // Verify DashboardLayout structure
    const dashHtml = renderWithRouter('/dashboard', {
      loading: false,
      user: { role: 'customer', name: 'Alice' },
      isAuthenticated: true,
      error: null,
    });
    assert.ok(dashHtml.includes('max-w-7xl mx-auto w-full'), 'DashboardLayout must render main outlet wrapper');
    assert.ok(dashHtml.includes('Customer Dashboard (Protected)'), 'DashboardLayout Outlet must render child page');
  });

  test('14. App.jsx structure: renders BrowserRouter -> AuthProvider -> AppRouter without duplicate routers', () => {
    const appPath = path.join(clientSrcDir, 'App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    // App.jsx must import and render BrowserRouter, AuthProvider, and AppRouter
    assert.ok(appContent.includes("import { BrowserRouter } from 'react-router-dom';"), 'App.jsx must import BrowserRouter');
    assert.ok(appContent.includes("import { AuthProvider } from './context/AuthContext.jsx';"), 'App.jsx must import AuthProvider');
    assert.ok(appContent.includes("import AppRouter from './routes/AppRouter.jsx';"), 'App.jsx must import AppRouter');

    // App.jsx must not declare duplicate inline routes
    assert.ok(!appContent.includes('<Routes>'), 'App.jsx must not contain inline <Routes> elements');
    assert.ok(!appContent.includes('<Route '), 'App.jsx must not contain inline <Route> elements');
  });

  test('15. Security verification: Zero token storage across layout and router files', () => {
    const filesToAudit = [
      path.join(clientSrcDir, 'routes/AppRouter.jsx'),
      path.join(clientSrcDir, 'routes/ProtectedRoute.jsx'),
      path.join(clientSrcDir, 'layouts/MainLayout.jsx'),
      path.join(clientSrcDir, 'layouts/AuthLayout.jsx'),
      path.join(clientSrcDir, 'layouts/DashboardLayout.jsx'),
      path.join(clientSrcDir, 'pages/HomePage.jsx'),
      path.join(clientSrcDir, 'pages/DashboardPage.jsx'),
      path.join(clientSrcDir, 'pages/OwnerDashboardPage.jsx'),
      path.join(clientSrcDir, 'pages/NotFoundPage.jsx'),
      path.join(clientSrcDir, 'App.jsx'),
    ];

    for (const filePath of filesToAudit) {
      assert.ok(fs.existsSync(filePath), `File must exist: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      assert.ok(!codeWithoutComments.includes('localStorage'), `Forbidden localStorage call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('sessionStorage'), `Forbidden sessionStorage call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('indexedDB'), `Forbidden indexedDB call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('document.cookie'), `Forbidden document.cookie call in ${filePath}`);
    }
  });
});
