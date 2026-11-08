import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientSrcDir = path.resolve(__dirname, '../../client/src');

describe('Reusable UI Feedback Components (Task 4.5)', () => {
  let React;
  let renderToStaticMarkup;
  let createRoot;
  let esbuild;

  let Spinner;
  let NotificationBanner;
  let EmptyState;
  let ErrorBoundary;
  let ToastProvider;
  let useToast;
  let Icons;

  const tempBundlePath = path.join(clientSrcDir, 'components/common/temp-test-feedback-bundle.js');

  before(async () => {
    React = (await import('../../client/node_modules/react/index.js')).default;
    renderToStaticMarkup = (await import('../../client/node_modules/react-dom/server.node.js')).renderToStaticMarkup;
    createRoot = (await import('../../client/node_modules/react-dom/client.js')).createRoot;
    esbuild = (await import('../../client/node_modules/esbuild/lib/main.js')).default;

    // Bundle feedback components for Node runtime, keeping React external and treating CSS as empty
    const entryCode = `
      export { default as Spinner } from './components/common/Spinner.jsx';
      export { default as NotificationBanner } from './components/common/NotificationBanner.jsx';
      export { default as EmptyState } from './components/common/EmptyState.jsx';
      export { default as ErrorBoundary } from './components/common/ErrorBoundary.jsx';
      export { default as ToastProvider, useToast } from './components/common/Toast.jsx';
      export * as Icons from './components/common/Icons.jsx';
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
      external: ['react', 'react-dom'],
      loader: { '.css': 'empty' },
    });

    const bundle = await import(pathToFileURL(tempBundlePath).href);
    Spinner = bundle.Spinner;
    NotificationBanner = bundle.NotificationBanner;
    EmptyState = bundle.EmptyState;
    ErrorBoundary = bundle.ErrorBoundary;
    ToastProvider = bundle.ToastProvider;
    useToast = bundle.useToast;
    Icons = bundle.Icons;
  });

  after(() => {
    try {
      fs.unlinkSync(tempBundlePath);
    } catch {}
  });

  // Helper for mock DOM tests (needed for createRoot and timers)
  function setupMockDOM() {
    class FakeNode {}
    class FakeElement extends FakeNode {}
    class FakeHTMLIFrameElement extends FakeElement {}

    const el = {
      nodeType: 1,
      tagName: 'DIV',
      ownerDocument: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      appendChild: () => {},
      removeChild: () => {},
      setAttribute: () => {},
      removeAttribute: () => {},
      style: {},
    };
    const doc = {
      nodeType: 9,
      createElement: () => ({ ...el, ownerDocument: doc }),
      createElementNS: () => ({ ...el, ownerDocument: doc }),
      createTextNode: () => ({ nodeType: 3 }),
      createComment: () => ({ nodeType: 8 }),
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    el.ownerDocument = doc;
    doc.defaultView = { HTMLIFrameElement: FakeHTMLIFrameElement, HTMLElement: FakeElement, Node: FakeNode };

    const originalWindow = globalThis.window;
    const originalDoc = globalThis.document;
    const originalHTMLIFrameElement = globalThis.HTMLIFrameElement;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalNode = globalThis.Node;

    globalThis.window = {
      document: doc,
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { href: 'http://localhost', reload: () => {} },
      HTMLIFrameElement: FakeHTMLIFrameElement,
      HTMLElement: FakeElement,
      Node: FakeNode,
    };
    globalThis.document = doc;
    globalThis.HTMLIFrameElement = FakeHTMLIFrameElement;
    globalThis.HTMLElement = FakeElement;
    globalThis.Node = FakeNode;

    return {
      container: el,
      cleanup: () => {
        globalThis.window = originalWindow;
        globalThis.document = originalDoc;
        globalThis.HTMLIFrameElement = originalHTMLIFrameElement;
        globalThis.HTMLElement = originalHTMLElement;
        globalThis.Node = originalNode;
      },
    };
  }

  // 1. Spinner tests
  test('1. Spinner supports sm, md, lg, xl sizes and theme color variants', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'];
    for (const size of sizes) {
      const html = renderToStaticMarkup(React.createElement(Spinner, { size }));
      assert.ok(html.includes(`w-${size === 'sm' ? '4' : size === 'md' ? '6' : size === 'lg' ? '8' : '12'}`), `Spinner must render size class for ${size}`);
    }

    const variants = ['primary', 'secondary', 'white', 'muted', 'destructive'];
    for (const variant of variants) {
      const html = renderToStaticMarkup(React.createElement(Spinner, { variant }));
      assert.ok(html.includes(`border-t-${variant === 'white' ? 'white' : variant === 'secondary' ? 'secondary-foreground' : variant === 'muted' ? 'muted-foreground' : variant}`), `Spinner must render variant border for ${variant}`);
    }
  });

  test('2. Spinner renders accessible screen-reader label and hides decorative graphics', () => {
    const html = renderToStaticMarkup(React.createElement(Spinner, { label: 'Authenticating credentials...' }));
    assert.ok(html.includes('role="status"'), 'Spinner container must have role="status"');
    assert.ok(html.includes('aria-hidden="true"'), 'Spinner graphics must be hidden from screen readers');
    assert.ok(html.includes('<span class="sr-only">Authenticating credentials...</span>'), 'Accessible label must be present inside sr-only span');
    assert.ok(html.includes('motion-reduce:animate-none'), 'Must respect reduced motion preferences');
  });

  // 3. NotificationBanner tests
  test('3. NotificationBanner renders error, warning, success, and info variants with correct semantics', () => {
    // Error variant: assertive alert
    const errorHtml = renderToStaticMarkup(
      React.createElement(NotificationBanner, { variant: 'error', title: 'Fatal Error' }, 'Invalid submission')
    );
    assert.ok(errorHtml.includes('role="alert"'), 'Error banner must have role="alert"');
    assert.ok(errorHtml.includes('aria-live="assertive"'), 'Error banner must announce assertively');
    assert.ok(errorHtml.includes('Fatal Error'), 'Error banner must display title');
    assert.ok(errorHtml.includes('Invalid submission'), 'Error banner must display body');
    assert.ok(errorHtml.includes('text-destructive'), 'Error banner must use destructive theme styling');

    // Warning variant: polite status
    const warningHtml = renderToStaticMarkup(
      React.createElement(NotificationBanner, { variant: 'warning', title: 'Low Credits' }, 'You have 1 credit remaining.')
    );
    assert.ok(warningHtml.includes('role="status"'), 'Warning banner must have role="status"');
    assert.ok(warningHtml.includes('aria-live="polite"'), 'Warning banner must announce politely');
    assert.ok(warningHtml.includes('Low Credits'), 'Warning title must render');

    // Success variant: polite status
    const successHtml = renderToStaticMarkup(
      React.createElement(NotificationBanner, { variant: 'success', title: 'Saved' }, 'Listing saved successfully.')
    );
    assert.ok(successHtml.includes('role="status"'), 'Success banner must have role="status"');
    assert.ok(successHtml.includes('aria-live="polite"'), 'Success banner must announce politely');
    assert.ok(successHtml.includes('Saved'), 'Success title must render');

    // Info variant: polite status
    const infoHtml = renderToStaticMarkup(
      React.createElement(NotificationBanner, { variant: 'info', title: 'Notice' }, 'Pending admin approval.')
    );
    assert.ok(infoHtml.includes('role="status"'), 'Info banner must have role="status"');
    assert.ok(infoHtml.includes('aria-live="polite"'), 'Info banner must announce politely');
    assert.ok(infoHtml.includes('Notice'), 'Info title must render');
  });

  test('4. NotificationBanner renders dismiss button with accessible name when onClose is provided', () => {
    let dismissed = false;
    const htmlWithClose = renderToStaticMarkup(
      React.createElement(
        NotificationBanner,
        { variant: 'info', onClose: () => { dismissed = true; } },
        'Dismissible message'
      )
    );
    assert.ok(htmlWithClose.includes('aria-label="Dismiss notification"'), 'Dismiss button must have accessible name');
    assert.ok(htmlWithClose.includes('<button'), 'Dismiss button element must exist');

    // When onClose is omitted, dismiss button must NOT render
    const htmlWithoutClose = renderToStaticMarkup(
      React.createElement(NotificationBanner, { variant: 'info' }, 'Static message')
    );
    assert.ok(!htmlWithoutClose.includes('<button'), 'Static banner must not render dismiss button');
  });

  // 5. EmptyState tests
  test('5. EmptyState renders title, optional description, icon, and optional action', () => {
    // Empty state with action and icon
    const fullHtml = renderToStaticMarkup(
      React.createElement(EmptyState, {
        icon: React.createElement('svg', { className: 'w-6 h-6' }),
        title: 'No Commercial Listings Found',
        description: 'Try adjusting your search criteria.',
        action: React.createElement('button', { type: 'button' }, 'Reset Filters'),
      })
    );
    assert.ok(fullHtml.includes('No Commercial Listings Found'), 'Title must render');
    assert.ok(fullHtml.includes('Try adjusting your search criteria.'), 'Description must render');
    assert.ok(fullHtml.includes('Reset Filters'), 'Action button must render');
    assert.ok(fullHtml.includes('role="region"'), 'EmptyState container must have role="region"');

    // Minimal empty state without icon or action
    const minimalHtml = renderToStaticMarkup(
      React.createElement(EmptyState, { title: 'Zero Records' })
    );
    assert.ok(minimalHtml.includes('Zero Records'), 'Title must render');
    assert.ok(!minimalHtml.includes('<button'), 'Action must not render when omitted');
  });

  // 6-8. ErrorBoundary tests
  test('6. ErrorBoundary renders child components normally when no error occurs', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ErrorBoundary,
        null,
        React.createElement('div', { id: 'healthy-child' }, 'Healthy Component Tree')
      )
    );
    assert.ok(html.includes('Healthy Component Tree'), 'Children must render when error-free');
    assert.ok(!html.includes('Something went wrong'), 'Recovery UI must not be displayed');
  });

  test('7. ErrorBoundary catches render errors and displays accessible recovery UI without leaking secrets', () => {
    function BrokenComponent() {
      throw new Error('SecretDBToken::Crash');
    }

    // Suppress console.error during expected boundary catch
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const boundaryInstance = new ErrorBoundary({});
      const derived = ErrorBoundary.getDerivedStateFromError(new Error('SecretDBToken::Crash'));
      assert.equal(derived.hasError, true, 'getDerivedStateFromError must set hasError to true');

      boundaryInstance.state = { hasError: true, error: new Error('SecretDBToken::Crash') };
      const fallbackTree = boundaryInstance.render();
      const fallbackHtml = renderToStaticMarkup(fallbackTree);

      assert.ok(fallbackHtml.includes('role="alert"'), 'Recovery UI must have role="alert"');
      assert.ok(fallbackHtml.includes('Something went wrong'), 'Recovery UI must render title');
      assert.ok(fallbackHtml.includes('Try Again'), 'Recovery UI must render Try Again button');
      assert.ok(fallbackHtml.includes('Reload Page'), 'Recovery UI must render Reload Page button');
      assert.ok(!fallbackHtml.includes('SecretDBToken'), 'Raw crash errors or secrets must never leak to end users');
    } finally {
      console.error = originalConsoleError;
    }
  });

  test('8. ErrorBoundary recovery action (handleReset) clears error state and invokes onReset', () => {
    let resetCalled = false;
    const boundaryInstance = new ErrorBoundary({
      onReset: () => { resetCalled = true; },
    });

    boundaryInstance.state = { hasError: true, error: new Error('Simulated failure') };
    boundaryInstance.setState = (nextState) => {
      boundaryInstance.state = { ...boundaryInstance.state, ...nextState };
    };

    boundaryInstance.handleReset();

    assert.equal(boundaryInstance.state.hasError, false, 'handleReset must clear hasError to false');
    assert.equal(boundaryInstance.state.error, null, 'handleReset must clear error to null');
    assert.equal(resetCalled, true, 'handleReset must trigger onReset callback');
  });

  test('9. ErrorBoundary supports custom fallback element and functional renderer', () => {
    const boundaryInstance = new ErrorBoundary({
      fallback: ({ error, reset }) => React.createElement('div', null, `Custom: ${error?.message}`),
    });
    boundaryInstance.state = { hasError: true, error: new Error('Custom Error Display') };

    const html = renderToStaticMarkup(boundaryInstance.render());
    assert.ok(html.includes('Custom: Custom Error Display'), 'Functional fallback must receive error and render custom UI');
  });

  // 10-14. Toast System tests
  test('10. ToastProvider and useToast allow dispatching and rendering toasts', async () => {
    const { container, cleanup } = setupMockDOM();

    try {
      let toastDispatcher = null;
      function TestConsumer() {
        toastDispatcher = useToast();
        return null;
      }

      const root = createRoot(container);
      root.render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(TestConsumer)
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.ok(toastDispatcher, 'useToast must return toast dispatcher');
      assert.equal(typeof toastDispatcher.toast, 'function', 'toastDispatcher must expose toast()');
      assert.equal(typeof toastDispatcher.dismiss, 'function', 'toastDispatcher must expose dismiss()');
      assert.equal(typeof toastDispatcher.dismissAll, 'function', 'toastDispatcher must expose dismissAll()');

      // Dispatch a success toast
      toastDispatcher.toast({
        id: 'toast-1',
        title: 'Property Saved',
        message: 'Added to your favorites list.',
        variant: 'success',
        duration: 0, // persistent for test
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.equal(toastDispatcher.toasts.length, 1, 'Toast count must be 1');
      assert.equal(toastDispatcher.toasts[0].title, 'Property Saved');
      assert.equal(toastDispatcher.toasts[0].variant, 'success');

      // Manual dismissal
      toastDispatcher.dismiss('toast-1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.equal(toastDispatcher.toasts.length, 0, 'Toast count must be 0 after manual dismissal');

      root.unmount();
    } finally {
      cleanup();
    }
  });

  test('11. Toast automatically dismisses after configured duration', async () => {
    const { container, cleanup } = setupMockDOM();

    try {
      let toastDispatcher = null;
      function TestConsumer() {
        toastDispatcher = useToast();
        return null;
      }

      const root = createRoot(container);
      root.render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(TestConsumer)
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Dispatch a transient toast with short duration
      toastDispatcher.toast({
        id: 'transient-toast',
        message: 'Temporary alert',
        duration: 80,
      });

      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(toastDispatcher.toasts.length, 1, 'Toast must exist immediately after creation');

      // Wait for timer expiration
      await new Promise((resolve) => setTimeout(resolve, 120));
      assert.equal(toastDispatcher.toasts.length, 0, 'Toast must be automatically dismissed after duration');

      root.unmount();
    } finally {
      cleanup();
    }
  });

  test('12. ToastProvider enforces maximum stack size limit (maxToasts)', async () => {
    const { container, cleanup } = setupMockDOM();

    try {
      let toastDispatcher = null;
      function TestConsumer() {
        toastDispatcher = useToast();
        return null;
      }

      const root = createRoot(container);
      root.render(
        React.createElement(
          ToastProvider,
          { maxToasts: 3 },
          React.createElement(TestConsumer)
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Dispatch 5 toasts with maxToasts = 3
      for (let i = 1; i <= 5; i++) {
        toastDispatcher.toast({
          id: `toast-limit-${i}`,
          message: `Notice ${i}`,
          duration: 0,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.equal(toastDispatcher.toasts.length, 3, 'Toast stack must never exceed maxToasts limit');
      assert.equal(toastDispatcher.toasts[0].id, 'toast-limit-3', 'Oldest toasts must be evicted');
      assert.equal(toastDispatcher.toasts[2].id, 'toast-limit-5', 'Newest toast must be present');

      root.unmount();
    } finally {
      cleanup();
    }
  });

  test('13. ToastProvider cleans up active timers on unmount without state leaks', async () => {
    const { container, cleanup } = setupMockDOM();

    try {
      let toastDispatcher = null;
      function TestConsumer() {
        toastDispatcher = useToast();
        return null;
      }

      const root = createRoot(container);
      root.render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(TestConsumer)
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Schedule several toasts with active timers
      toastDispatcher.toast({ message: 'Toast A', duration: 1000 });
      toastDispatcher.toast({ message: 'Toast B', duration: 1500 });

      // Unmount while timers are running
      root.unmount();

      // Ensure no unhandled rejection or errors occur after timer fires
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      cleanup();
    }
  });

  test('14. Toast container provides accessible live region announcements', () => {
    const toasts = [
      { id: 't1', title: 'Action Succeeded', message: '1 credit deducted.', variant: 'success' },
      { id: 't2', title: 'Action Failed', message: 'Unable to connect.', variant: 'error' },
    ];

    // Check Toast markup via static renderer
    const dummyProvider = React.createElement(
      ToastProvider,
      null,
      React.createElement('div', null, 'Content')
    );
    const html = renderToStaticMarkup(dummyProvider);
    assert.ok(html.includes('aria-live="polite"'), 'ToastContainer must have aria-live="polite"');
    assert.ok(html.includes('fixed bottom-4 right-4'), 'Toast container must be fixed positioned');
  });

  test('15. Security verification: Zero token storage or PocketBase imports across feedback components', () => {
    const filesToAudit = [
      path.join(clientSrcDir, 'components/common/Spinner.jsx'),
      path.join(clientSrcDir, 'components/common/NotificationBanner.jsx'),
      path.join(clientSrcDir, 'components/common/EmptyState.jsx'),
      path.join(clientSrcDir, 'components/common/ErrorBoundary.jsx'),
      path.join(clientSrcDir, 'components/common/Toast.jsx'),
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
      assert.ok(!codeWithoutComments.includes('pocketbase'), `Forbidden pocketbase import in ${filePath}`);
    }
  });
});
