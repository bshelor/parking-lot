const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ─── Configuration ───────────────────────────────────────────────
const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  headed: process.env.HEADED === 'true',
  slowMo: parseInt(process.env.SLOW_MO || '300'),
  viewport: { width: 1440, height: 900 },
  pauseBetweenPages: parseInt(process.env.PAUSE_MS || '2000'),
  maxPages: parseInt(process.env.MAX_PAGES || '50'),
  ignorePatterns: (process.env.IGNORE_PATTERNS || 'mailto:,javascript:,logout,sign-out,#').split(','),

  // Navigation selectors — targets common SPA nav patterns
  navSelectors: (process.env.NAV_SELECTORS || 'nav a[href],aside a[href],[role="navigation"] a[href],a[href]').split(','),

  // Optional: login credentials
  login: process.env.LOGIN_URL ? {
    url: process.env.LOGIN_URL,
    usernameSelector: process.env.USERNAME_SELECTOR || 'input[name="email"]',
    passwordSelector: process.env.PASSWORD_SELECTOR || 'input[name="password"]',
    submitSelector: process.env.SUBMIT_SELECTOR || 'button[type="submit"]',
    username: process.env.APP_USERNAME,
    password: process.env.APP_PASSWORD,
  } : null,

  // App startup — configure these to auto-start your apps
  // Each entry: { name, command, cwd, port, healthUrl }
  apps: parseApps(),
};

function parseApps() {
  const apps = [];

  // Frontend
  if (process.env.FRONTEND_CMD) {
    apps.push({
      name: process.env.FRONTEND_NAME || 'frontend',
      command: process.env.FRONTEND_CMD,
      cwd: process.env.FRONTEND_CWD || process.cwd(),
      port: parseInt(process.env.FRONTEND_PORT || '3000'),
      healthUrl: process.env.FRONTEND_HEALTH || null,
    });
  }

  // Backend
  if (process.env.BACKEND_CMD) {
    apps.push({
      name: process.env.BACKEND_NAME || 'backend',
      command: process.env.BACKEND_CMD,
      cwd: process.env.BACKEND_CWD || process.cwd(),
      port: parseInt(process.env.BACKEND_PORT || '8080'),
      healthUrl: process.env.BACKEND_HEALTH || null,
    });
  }

  return apps;
}

// ─── App Lifecycle ───────────────────────────────────────────────
const childProcesses = [];

async function startApps() {
  if (config.apps.length === 0) return;

  for (const app of config.apps) {
    console.log(`Starting ${app.name}: ${app.command} (cwd: ${app.cwd})`);

    const [cmd, ...args] = app.command.split(' ');
    const child = spawn(cmd, args, {
      cwd: app.cwd,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env },
    });

    child.stdout.on('data', (d) => process.stdout.write(`  [${app.name}] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`  [${app.name}] ${d}`));
    child.on('error', (err) => console.error(`  [${app.name}] Failed to start: ${err.message}`));

    childProcesses.push(child);

    // Wait for the app to be reachable
    const url = app.healthUrl || `http://localhost:${app.port}`;
    await waitForReady(url, app.name);
  }

  console.log('All apps started.\n');
}

function waitForReady(url, name, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        console.log(`  ${name} ready (${res.statusCode})`);
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`${name} did not become ready within ${timeoutMs / 1000}s`));
          return;
        }
        setTimeout(check, 1000);
      });
      req.end();
    };
    check();
  });
}

function stopApps() {
  for (const child of childProcesses) {
    child.kill('SIGTERM');
  }
}

// ─── SPA-Aware Link Discovery ───────────────────────────────────
async function discoverLinks(page) {
  const baseOrigin = new URL(config.baseUrl).origin;

  // Collect hrefs from all nav selectors (prioritized order)
  const allHrefs = [];
  for (const selector of config.navSelectors) {
    const hrefs = await page.$$eval(selector.trim(), (anchors) =>
      anchors.map(a => ({
        href: a.href,
        text: a.textContent.trim(),
        isNav: !!a.closest('nav, aside, [role="navigation"], [class*="sidebar"], [class*="menu"], [class*="nav"]'),
      }))
    ).catch(() => []);
    allHrefs.push(...hrefs);
  }

  // Dedupe by href, prefer nav links
  const seen = new Map();
  for (const link of allHrefs) {
    if (!link.href || seen.has(link.href)) continue;
    seen.set(link.href, link);
  }

  const results = [];
  for (const [href, link] of seen) {
    try {
      const url = new URL(href);
      if (url.origin !== baseOrigin) continue;
      if (config.ignorePatterns.some(p => href.includes(p.trim()))) continue;

      const pathname = url.pathname + url.search;
      // Skip hash-only differences
      if (url.hash && !url.pathname) continue;

      results.push({
        path: pathname,
        text: link.text,
        isNav: link.isNav,
      });
    } catch {
      continue;
    }
  }

  // Dedupe by path, nav links first
  const pathMap = new Map();
  for (const r of results) {
    if (!pathMap.has(r.path) || r.isNav) {
      pathMap.set(r.path, r);
    }
  }

  return [...pathMap.values()];
}

// Navigate via clicking (triggers React Router) instead of page.goto()
async function navigateToPath(page, targetPath) {
  const currentPath = new URL(page.url()).pathname;

  // If we're already here, skip
  if (currentPath === targetPath) return true;

  // Try clicking a link that points to this path
  const baseOrigin = new URL(config.baseUrl).origin;
  const targetUrl = `${baseOrigin}${targetPath}`;

  const link = await page.$(`a[href="${targetPath}"], a[href="${targetUrl}"]`);
  if (link) {
    const isVisible = await link.isVisible().catch(() => false);
    if (isVisible) {
      await link.click();
      await waitForSPANavigation(page);
      return true;
    }
  }

  // Fallback: direct navigation (works for React Router since it catches route changes)
  await page.goto(`${config.baseUrl}${targetPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await waitForSPANavigation(page);
  return true;
}

async function waitForSPANavigation(page) {
  // Wait for React to settle — no network activity + no DOM mutations for 500ms
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(500);

  // Wait for any lazy-loaded content / spinners to resolve
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll(
      '[class*="spinner"], [class*="loading"], [class*="skeleton"], [role="progressbar"]'
    );
    return spinners.length === 0;
  }, { timeout: 10000 }).catch(() => {});

  await page.waitForTimeout(300);
}

// ─── Expand Menus / Subnavs ─────────────────────────────────────
async function expandMenus(page) {
  // Click expandable menu items to reveal subnav links
  const expandSelectors = [
    '[aria-expanded="false"]',
    'button[class*="menu"]',
    '[class*="expandable"]',
    '[class*="collapsible"] > button',
    '[class*="submenu"] > button',
    'details:not([open]) > summary',
  ];

  for (const selector of expandSelectors) {
    const elements = await page.$$(selector);
    for (const el of elements) {
      const isVisible = await el.isVisible().catch(() => false);
      if (isVisible) {
        await el.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const screenshotDir = path.join(__dirname, 'screenshots', dateStr);
  const videoDir = path.join(__dirname, 'videos');

  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });

  // Start apps if configured
  await startApps();

  const browser = await chromium.launch({
    headless: !config.headed,
    slowMo: config.slowMo,
  });

  const context = await browser.newContext({
    viewport: config.viewport,
    recordVideo: { dir: videoDir, size: config.viewport },
  });

  const page = await context.newPage();
  const visited = new Set();
  const toVisit = [{ path: '/', text: 'home', isNav: true }];
  let pageCount = 0;

  try {
    // Login if configured
    if (config.login) {
      await login(page);
    }

    // Initial navigation
    await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForSPANavigation(page);

    console.log(`Starting capture of ${config.baseUrl}`);
    console.log(`Max pages: ${config.maxPages}\n`);

    // Expand any collapsed menus on initial page
    await expandMenus(page);

    // Discover initial links
    const initialLinks = await discoverLinks(page);
    for (const link of initialLinks) {
      if (!toVisit.some(v => v.path === link.path)) {
        toVisit.push(link);
      }
    }

    // Prioritize: nav links first, then others
    toVisit.sort((a, b) => (b.isNav ? 1 : 0) - (a.isNav ? 1 : 0));

    // Crawl and capture
    while (toVisit.length > 0 && pageCount < config.maxPages) {
      const current = toVisit.shift();
      if (visited.has(current.path)) continue;
      visited.add(current.path);

      pageCount++;
      console.log(`[${pageCount}] ${current.path}${current.text ? ` (${current.text})` : ''}`);

      try {
        await navigateToPath(page, current.path);
      } catch (err) {
        console.log(`  Skipped (${err.message})`);
        continue;
      }

      // Screenshot
      const safeName = current.path.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'home';
      const screenshotPath = path.join(screenshotDir, `${String(pageCount).padStart(3, '0')}-${safeName}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Expand menus on this page and discover new links
      await expandMenus(page);
      const links = await discoverLinks(page);
      for (const link of links) {
        if (!visited.has(link.path) && !toVisit.some(v => v.path === link.path)) {
          toVisit.push(link);
        }
      }

      await page.waitForTimeout(config.pauseBetweenPages);
    }

    console.log(`\nCaptured ${pageCount} pages`);
    console.log(`Screenshots: ${screenshotDir}`);
  } catch (err) {
    console.error('Capture failed:', err.message);
  } finally {
    await context.close(); // saves the video
    await browser.close();
    stopApps();

    // Rename video file with date
    const videos = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm') && !f.startsWith('20'));
    const latest = videos.sort().pop();
    if (latest) {
      const oldPath = path.join(videoDir, latest);
      let newPath = path.join(videoDir, `${dateStr}.webm`);
      let counter = 1;
      while (fs.existsSync(newPath)) {
        newPath = path.join(videoDir, `${dateStr}-${counter}.webm`);
        counter++;
      }
      fs.renameSync(oldPath, newPath);
      console.log(`Video: ${newPath}`);
    }
  }
}

async function login(page) {
  const { login: creds } = config;
  if (!creds.username || !creds.password) {
    console.log('Login configured but credentials not set — skipping. Set APP_USERNAME and APP_PASSWORD env vars.');
    return;
  }

  console.log(`Logging in at: ${creds.url}`);
  await page.goto(creds.url, { waitUntil: 'domcontentloaded' });
  await waitForSPANavigation(page);
  await page.fill(creds.usernameSelector, creds.username);
  await page.fill(creds.passwordSelector, creds.password);
  await page.click(creds.submitSelector);
  await waitForSPANavigation(page);
  console.log('Login complete\n');
}

// Cleanup on unexpected exit
process.on('SIGINT', () => { stopApps(); process.exit(); });
process.on('SIGTERM', () => { stopApps(); process.exit(); });

main();
