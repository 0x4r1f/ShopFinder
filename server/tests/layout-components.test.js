import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('Global Layout Components (Header, Footer, MobileNav, Sidebar) — Task 4.4', () => {
  let React;
  let renderToStaticMarkup;
  let MemoryRouter;
  let Routes;
  let Route;
  let esbuild;
  let AuthContext;
  let Header;
  let MobileNav;
  let Footer;
  let Sidebar;
  let MainLayout;
  let DashboardLayout;

  const tempAuthPath = path.join(clientSrcDir, 'context/temp-test-layout-auth.js');
  const tempBundlePath = path.join(clientSrcDir, 'components/layout/temp-test-layout-bundle.js');

  before(async () => {
    React = (await import('../../client/node_modules/react/index.js')).default;
    renderToStaticMarkup = (await import('../../client/node_modules/react-dom/server.node.js')).renderToStaticMarkup;
    const routerModule = await import('../../client/node_modules/react-router-dom/dist/index.js');
    MemoryRouter = routerModule.MemoryRouter;
    Routes = routerModule.Routes;
    Route = routerModule.Route;
    esbuild = (await import('../../client/node_modules/esbuild/lib/main.js')).default;

    // 1. Compile AuthContext
    const authRaw = fs.readFileSync(path.join(clientSrcDir, 'context/AuthContext.jsx'), 'utf8');
    const authCode = esbuild.transformSync(authRaw, { loader: 'jsx' }).code;
    fs.writeFileSync(tempAuthPath, authCode);

    // 2. Bundle all layout components using stdin without writing a temp entry file to client/src
    const entryCode = `
      export { default as Header } from './components/layout/Header.jsx';
      export { default as MobileNav } from './components/layout/MobileNav.jsx';
      export { default as Footer } from './components/layout/Footer.jsx';
      export { default as Sidebar } from './components/layout/Sidebar.jsx';
      export { default as MainLayout } from './layouts/MainLayout.jsx';
      export { default as DashboardLayout } from './layouts/DashboardLayout.jsx';
    `;

    await esbuild.build({
      stdin: {
        contents: entryCode,
        resolveDir: clientSrcDir,
        loader: 'js',
      },
      bundle: true,
      format: 'esm',
      outfile: tempBundlePath,
      external: ['react', 'react-dom', 'react-router-dom'],
      loader: { '.css': 'empty' },
      plugins: [
        {
          name: 'alias-auth-context',
          setup(build) {
            build.onResolve({ filter: /AuthContext\.jsx$/ }, () => {
              return { path: pathToFileURL(tempAuthPath).href, external: true };
            });
          },
        },
      ],
    });

    AuthContext = (await import(pathToFileURL(tempAuthPath).href)).AuthContext;
    const bundle = await import(pathToFileURL(tempBundlePath).href);
    Header = bundle.Header;
    MobileNav = bundle.MobileNav;
    Footer = bundle.Footer;
    Sidebar = bundle.Sidebar;
    MainLayout = bundle.MainLayout;
    DashboardLayout = bundle.DashboardLayout;
  });

  after(() => {
    try {
      fs.unlinkSync(tempAuthPath);
    } catch {}
    try {
      fs.unlinkSync(tempBundlePath);
    } catch {}
  });

  function renderWithContext(component, authState, initialEntries = ['/']) {
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
          { initialEntries },
          React.createElement(
            AuthContext.Provider,
            { value: authState },
            component
          )
        )
      );
    } finally {
      console.error = originalError;
    }
  }

  test('1. Public visitor sees correct public navigation and auth actions in Header', () => {
    const authState = {
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      logout: () => {},
    };

    const html = renderWithContext(React.createElement(Header), authState);

    // Brand logo linking to /
    assert.ok(html.includes('href="/"'), 'Brand must link to /');
    assert.ok(html.includes('ShopFinder'), 'Brand name must render');

    // Public links
    assert.ok(html.includes('Home'), 'Home link must render');
    assert.ok(html.includes('Marketplace'), 'Marketplace link must render');

    // Auth actions for visitor
    assert.ok(html.includes('href="/login"'), 'Sign In link must be present');
    assert.ok(html.includes('Sign In'), 'Sign In text must render');
    assert.ok(html.includes('href="/register"'), 'Register link must be present');
    assert.ok(html.includes('Register'), 'Register text must render');

    // Authenticated dashboard links must NOT appear
    assert.ok(!html.includes('Customer Dashboard'), 'Customer dashboard must not render for visitor');
    assert.ok(!html.includes('Owner Portal'), 'Owner portal must not render for visitor');
    assert.ok(!html.includes('Log Out'), 'Logout must not render for visitor');
  });

  test('2. Customer sees customer dashboard navigation in Header', () => {
    const authState = {
      user: { id: 'cust-1', name: 'Alice Customer', email: 'alice@example.com', role: 'customer' },
      isAuthenticated: true,
      loading: false,
      error: null,
      logout: () => {},
    };

    const html = renderWithContext(React.createElement(Header), authState);

    // Customer dashboard link
    assert.ok(html.includes('href="/dashboard"'), 'Must contain link to /dashboard');
    assert.ok(html.includes('Customer Dashboard'), 'Must contain Customer Dashboard label');

    // Owner/Admin links must NOT appear
    assert.ok(!html.includes('Owner Portal'), 'Owner portal must not appear for customer');
    assert.ok(!html.includes('Admin Portal'), 'Admin portal must not appear for customer');

    // Visitor actions must NOT appear
    assert.ok(!html.includes('href="/login"'), 'Sign In link must not appear');
  });

  test('3. Owner sees owner portal navigation in Header', () => {
    const authState = {
      user: { id: 'own-1', name: 'Bob Landlord', email: 'bob@example.com', role: 'owner' },
      isAuthenticated: true,
      loading: false,
      error: null,
      logout: () => {},
    };

    const html = renderWithContext(React.createElement(Header), authState);

    // Owner portal link
    assert.ok(html.includes('href="/owner-dashboard"'), 'Must contain link to /owner-dashboard');
    assert.ok(html.includes('Owner Portal'), 'Must contain Owner Portal label');

    // Customer dashboard link must NOT appear
    assert.ok(!html.includes('Customer Dashboard'), 'Customer dashboard must not appear for owner');
  });

  test('4. Admin sees admin portal navigation in Header', () => {
    const authState = {
      user: { id: 'adm-1', name: 'Carol Super', email: 'admin@example.com', role: 'admin' },
      isAuthenticated: true,
      loading: false,
      error: null,
      logout: () => {},
    };

    const html = renderWithContext(React.createElement(Header), authState);

    // Admin portal link
    assert.ok(
      html.includes('href="/admin-dashboard"') || html.includes('href="/owner-dashboard"'),
      'Must contain link to admin dashboard'
    );
    assert.ok(html.includes('Admin Portal'), 'Must contain Admin Portal label');

    // Customer dashboard link must NOT appear
    assert.ok(!html.includes('Customer Dashboard'), 'Customer dashboard must not appear for admin');
  });

  test('5. User identity and role badge render correctly in Header and Sidebar', () => {
    const authState = {
      user: { id: 'cust-1', name: 'Jane Doe', email: 'jane@example.com', role: 'customer' },
      isAuthenticated: true,
      loading: false,
      error: null,
      logout: () => {},
    };

    const headerHtml = renderWithContext(React.createElement(Header), authState);
    assert.ok(headerHtml.includes('Jane Doe'), 'Header must display user name');
    assert.ok(headerHtml.includes('jane@example.com'), 'Header must display user email');
    assert.ok(headerHtml.includes('Customer'), 'Header must display Customer badge');

    const sidebarHtml = renderWithContext(React.createElement(Sidebar), authState);
    assert.ok(sidebarHtml.includes('Jane Doe'), 'Sidebar must display user name');
    assert.ok(sidebarHtml.includes('jane@example.com'), 'Sidebar must display user email');
    assert.ok(sidebarHtml.includes('Customer'), 'Sidebar must display Customer badge');
  });

  test('6. Logout action exists and is properly wired with accessible controls', () => {
    const authState = {
      user: { id: 'u-1', name: 'Test User', email: 'test@example.com', role: 'customer' },
      isAuthenticated: true,
      loading: false,
      error: null,
      logout: () => {},
    };

    const headerHtml = renderWithContext(React.createElement(Header), authState);
    assert.ok(headerHtml.includes('Log Out'), 'Header must render Log Out button');
    assert.ok(headerHtml.includes('aria-label="Log out of your account"'), 'Header logout must have aria-label');

    const sidebarHtml = renderWithContext(React.createElement(Sidebar), authState);
    assert.ok(sidebarHtml.includes('Log Out'), 'Sidebar must render Log Out button');
    assert.ok(sidebarHtml.includes('aria-label="Log out of dashboard"'), 'Sidebar logout must have aria-label');
  });

  test('7. Upcoming sidebar entries are visibly marked and non-clickable (no fake routes/hash anchors)', () => {
    // Check Customer Sidebar
    const custAuthState = {
      user: { id: 'c1', name: 'Alice', email: 'a@example.com', role: 'customer' },
      isAuthenticated: true,
      loading: false,
      logout: () => {},
    };
    const custSidebar = renderWithContext(React.createElement(Sidebar), custAuthState);

    // Verify upcoming customer modules
    const expectedCustomerUpcoming = ['Saved Properties', 'Revealed Contacts', 'Subscription / Credits'];
    for (const item of expectedCustomerUpcoming) {
      assert.ok(custSidebar.includes(item), `Customer sidebar must include "${item}"`);
    }
    // Verify Upcoming badge & disabled state
    assert.ok(custSidebar.includes('Upcoming'), 'Sidebar must display Upcoming badge');
    assert.ok(custSidebar.includes('aria-disabled="true"'), 'Upcoming items must carry aria-disabled="true"');
    assert.ok(custSidebar.includes('cursor-not-allowed'), 'Upcoming items must carry cursor-not-allowed style');

    // Verify Owner Sidebar
    const ownerAuthState = {
      user: { id: 'o1', name: 'Bob', email: 'b@example.com', role: 'owner' },
      isAuthenticated: true,
      loading: false,
      logout: () => {},
    };
    const ownerSidebar = renderWithContext(React.createElement(Sidebar), ownerAuthState);
    const expectedOwnerUpcoming = ['My Listings', 'Add New Listing', 'Business Profile'];
    for (const item of expectedOwnerUpcoming) {
      assert.ok(ownerSidebar.includes(item), `Owner sidebar must include "${item}"`);
    }

    // Verify Admin Sidebar
    const adminAuthState = {
      user: { id: 'ad1', name: 'Carol', email: 'c@example.com', role: 'admin' },
      isAuthenticated: true,
      loading: false,
      logout: () => {},
    };
    const adminSidebar = renderWithContext(React.createElement(Sidebar), adminAuthState);
    const expectedAdminUpcoming = ['Listing Review Queue', 'User Management', 'Subscription Plans', 'Payment Logs'];
    for (const item of expectedAdminUpcoming) {
      assert.ok(adminSidebar.includes(item), `Admin sidebar must include "${item}"`);
    }

    // Strict check: zero fake hrefs or hash anchors in sidebar items
    assert.ok(!custSidebar.includes('href="#'), 'Must not contain hash anchor links');
    assert.ok(!ownerSidebar.includes('href="#'), 'Must not contain hash anchor links');
    assert.ok(!adminSidebar.includes('href="#'), 'Must not contain hash anchor links');
    assert.ok(!custSidebar.includes('href="/dashboard/saved"'), 'Must not create fake unimplemented routes');
    assert.ok(!ownerSidebar.includes('href="/owner-dashboard/listings"'), 'Must not create fake unimplemented routes');
  });

  test('8. Active navigation uses correct NavLink behavior with aria-current="page"', () => {
    const authState = {
      user: null,
      isAuthenticated: false,
      loading: false,
      logout: () => {},
    };

    // When on route "/", the Home NavLink must receive aria-current="page"
    const homeHtml = renderWithContext(React.createElement(Header), authState, ['/']);
    assert.ok(homeHtml.includes('aria-current="page"'), 'Active route must have aria-current="page"');

    // Customer on /dashboard
    const custAuthState = {
      user: { id: 'c1', name: 'Alice', email: 'a@example.com', role: 'customer' },
      isAuthenticated: true,
      loading: false,
      logout: () => {},
    };
    const dashHtml = renderWithContext(React.createElement(Sidebar), custAuthState, ['/dashboard']);
    assert.ok(dashHtml.includes('aria-current="page"'), 'Active dashboard route in sidebar must have aria-current="page"');
  });

  test('9. Mobile navigation exposes accessible ARIA attributes', () => {
    const authState = {
      user: null,
      isAuthenticated: false,
      loading: false,
      logout: () => {},
    };

    // Header hamburger button attributes
    const headerHtml = renderWithContext(React.createElement(Header), authState);
    assert.ok(headerHtml.includes('aria-label="Toggle navigation menu"'), 'Hamburger button must have aria-label');
    assert.ok(headerHtml.includes('aria-expanded="false"'), 'Initial aria-expanded must be false');
    assert.ok(headerHtml.includes('aria-controls="mobile-navigation"'), 'Hamburger must control mobile-navigation');

    // MobileNav dialog attributes when open
    const mobileNavHtml = renderWithContext(
      React.createElement(MobileNav, { isOpen: true, onClose: () => {} }),
      authState
    );
    assert.ok(mobileNavHtml.includes('id="mobile-navigation"'), 'MobileNav must have id="mobile-navigation"');
    assert.ok(mobileNavHtml.includes('role="dialog"'), 'MobileNav must have role="dialog"');
    assert.ok(mobileNavHtml.includes('aria-modal="true"'), 'MobileNav must have aria-modal="true"');
    assert.ok(mobileNavHtml.includes('aria-label="Mobile Navigation Menu"'), 'MobileNav must have aria-label');
    assert.ok(mobileNavHtml.includes('aria-label="Close navigation menu"'), 'Close button must have aria-label');
  });

  test('10. MobileNav returns null when closed', () => {
    const authState = { user: null, isAuthenticated: false, loading: false, logout: () => {} };
    const html = renderWithContext(
      React.createElement(MobileNav, { isOpen: false, onClose: () => {} }),
      authState
    );
    assert.equal(html, '', 'MobileNav must not render anything when isOpen is false');
  });

  test('11. MobileNav component source verifies Escape key and navigation close listeners', () => {
    const mobileNavSource = fs.readFileSync(path.join(clientSrcDir, 'components/layout/MobileNav.jsx'), 'utf8');
    assert.ok(mobileNavSource.includes("event.key === 'Escape'"), 'MobileNav must listen for Escape key');
    assert.ok(mobileNavSource.includes('onClose();'), 'MobileNav must trigger onClose on Escape');
    assert.ok(mobileNavSource.includes('onClick={onClose}'), 'MobileNav links must trigger onClose on click');
  });

  test('12. Footer renders commercial categories, platform info, and copyright without fake links', () => {
    const html = renderWithContext(React.createElement(Footer), {});

    // Landmark
    assert.ok(html.includes('role="contentinfo"'), 'Footer must carry role="contentinfo"');

    // Brand and description
    assert.ok(html.includes('ShopFinder'), 'Footer must contain brand name');
    assert.ok(html.includes('commercial property marketplace'), 'Footer must contain description');

    // Commercial categories
    const categories = ['Shop', 'Office', 'Restaurant', 'Warehouse', 'Showroom', 'Commercial Floor', 'Industrial Space'];
    for (const cat of categories) {
      assert.ok(html.includes(cat), `Footer must display category "${cat}"`);
    }

    // Verified links
    assert.ok(html.includes('href="/"'), 'Footer must link to Home');
    assert.ok(html.includes('href="/login"'), 'Footer must link to Login');
    assert.ok(html.includes('href="/register"'), 'Footer must link to Register');

    // Zero fake links
    assert.ok(!html.includes('href="#'), 'Footer must not contain hash anchor links');
    assert.ok(!html.includes('href="/categories/'), 'Footer must not invent fake category links');

    // Copyright
    const currentYear = new Date().getFullYear().toString();
    assert.ok(html.includes(currentYear), 'Footer must contain current year in copyright');
  });

  test('13. Layout integration preserves nested Outlet rendering', () => {
    const authState = {
      user: { id: 'c1', name: 'Alice', email: 'a@example.com', role: 'customer' },
      isAuthenticated: true,
      loading: false,
      logout: () => {},
    };

    // Test MainLayout integration with Header, Footer, and Outlet via nested Route
    const mainTree = React.createElement(
      Routes,
      null,
      React.createElement(
        Route,
        { element: React.createElement(MainLayout) },
        React.createElement(Route, {
          path: '/',
          element: React.createElement('div', null, 'MAIN_OUTLET_CONTENT'),
        })
      )
    );
    const mainLayoutHtml = renderWithContext(mainTree, authState, ['/']);
    assert.ok(mainLayoutHtml.includes('<header'), 'MainLayout must render <header>');
    assert.ok(mainLayoutHtml.includes('<footer'), 'MainLayout must render <footer>');
    assert.ok(mainLayoutHtml.includes('MAIN_OUTLET_CONTENT'), 'MainLayout must render Outlet child content');

    // Test DashboardLayout integration with Sidebar and Outlet via nested Route
    const dashTree = React.createElement(
      Routes,
      null,
      React.createElement(
        Route,
        { element: React.createElement(DashboardLayout) },
        React.createElement(Route, {
          path: '/dashboard',
          element: React.createElement('div', null, 'DASHBOARD_OUTLET_CONTENT'),
        })
      )
    );
    const dashLayoutHtml = renderWithContext(dashTree, authState, ['/dashboard']);
    assert.ok(dashLayoutHtml.includes('aria-label="Dashboard Sidebar"'), 'DashboardLayout must render Sidebar');
    assert.ok(dashLayoutHtml.includes('DASHBOARD_OUTLET_CONTENT'), 'DashboardLayout must render Outlet child content');
  });

  test('14. Security audit: Zero token storage across layout components', () => {
    const filesToAudit = [
      path.join(clientSrcDir, 'components/common/Icons.jsx'),
      path.join(clientSrcDir, 'components/layout/Header.jsx'),
      path.join(clientSrcDir, 'components/layout/MobileNav.jsx'),
      path.join(clientSrcDir, 'components/layout/Footer.jsx'),
      path.join(clientSrcDir, 'components/layout/Sidebar.jsx'),
      path.join(clientSrcDir, 'layouts/MainLayout.jsx'),
      path.join(clientSrcDir, 'layouts/DashboardLayout.jsx'),
    ];

    for (const filePath of filesToAudit) {
      assert.ok(fs.existsSync(filePath), `File must exist: ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      assert.ok(!codeWithoutComments.includes('localStorage'), `Forbidden localStorage call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('sessionStorage'), `Forbidden sessionStorage call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('indexedDB'), `Forbidden indexedDB call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('document.cookie'), `Forbidden document.cookie call in ${filePath}`);
      assert.ok(!codeWithoutComments.includes('pocketbase'), `Forbidden PocketBase client access in ${filePath}`);
    }
  });
});
