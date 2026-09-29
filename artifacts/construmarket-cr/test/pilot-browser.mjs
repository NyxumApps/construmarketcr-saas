import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = new URL('../../..', import.meta.url);
const unique = randomUUID().slice(0, 8);
const adminId = `browser_admin_${unique}`;
const professionalId = `browser_professional_${unique}`;
const title = `Casa navegador ${unique}`;
const professionalName = `Arq. Navegador ${unique}`;
const professionalEmail = `professional-${unique}@example.test`;
const buyerEmail = `buyer-${unique}@example.test`;
const planImagePath = fileURLToPath(new URL('../public/planes/plan-1.jpg', import.meta.url));
const mobileContext = {
  viewport: { width: 390, height: 844 },
};
const narrowViewport = { width: 320, height: 844 };
const children = [];
let output = '';

async function availablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address === 'object');
  server.close();
  await once(server, 'close');
  return address.port;
}

function run(command, args, options) {
  const child = spawn(command, args, {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  children.push(child);
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  return child;
}

async function stop(child) {
  if (child.exitCode !== null || !child.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Los servicios no iniciaron a tiempo.\n${output}`);
}

async function session(browser, baseUrl, userId) {
  const context = await browser.newContext(mobileContext);
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.evaluate((id) => localStorage.setItem('construmarket-e2e-user', id), userId);
  await page.goto(`${baseUrl}/sign-in`);
  const signInButton = page.getByRole('button', { name: 'Iniciar sesión de prueba' });
  await tabTo(page, signInButton);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/portal$/);
  return { context, page };
}

async function checkNarrowLayout(page, label, controls) {
  await page.setViewportSize(narrowViewport);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(
    dimensions.scrollWidth,
    dimensions.clientWidth,
    `${label}: hay desplazamiento horizontal (${dimensions.scrollWidth}px > ${dimensions.clientWidth}px)`,
  );

  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    assert(box, `${label}: no se pudo medir un control crítico`);
    assert(
      box.x >= 0 && box.x + box.width <= narrowViewport.width,
      `${label}: un control crítico queda fuera del viewport (${box.x}px a ${box.x + box.width}px)`,
    );
  }
}

async function tabTo(page, locator, options = {}) {
  const { backwards = false, maxTabs = 80 } = options;
  const unfocusedStyle = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outline, boxShadow: style.boxShadow };
  });
  for (let count = 0; count < maxTabs; count += 1) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    if (await locator.evaluate((element) => document.activeElement === element)) break;
  }
  await expect(locator).toBeFocused();
  const focusState = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      inViewport: bounds.top >= 0
        && bounds.left >= 0
        && bounds.bottom <= window.innerHeight
        && bounds.right <= window.innerWidth,
      visible: element.matches(':focus-visible'),
      outline: style.outline,
      boxShadow: style.boxShadow,
    };
  });
  assert.equal(focusState.inViewport, true, 'El control enfocado debe quedar dentro del viewport');
  assert.equal(focusState.visible, true, 'El control debe coincidir con :focus-visible');
  assert.notDeepEqual(
    { outline: focusState.outline, boxShadow: focusState.boxShadow },
    unfocusedStyle,
    'El foco debe cambiar visiblemente el outline o el ring del control',
  );
}

async function tabToUpload(page, input, visibleLabel) {
  const unfocusedOutline = await visibleLabel.evaluate((element) => getComputedStyle(element).outline);
  for (let count = 0; count < 80; count += 1) {
    await page.keyboard.press('Tab');
    if (await input.evaluate((element) => document.activeElement === element)) break;
  }
  await expect(input).toBeFocused();
  const focusState = await visibleLabel.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      inViewport: bounds.top >= 0
        && bounds.left >= 0
        && bounds.bottom <= window.innerHeight
        && bounds.right <= window.innerWidth,
      outline: getComputedStyle(element).outline,
    };
  });
  assert.equal(focusState.inViewport, true, 'La carga visible enfocada debe quedar dentro del viewport');
  assert.notEqual(focusState.outline, unfocusedOutline, 'La carga visible debe reflejar el foco del input');
}

const apiPort = await availablePort();
const webPort = await availablePort();
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const baseUrl = `http://127.0.0.1:${webPort}`;

try {
  run(process.execPath, ['--enable-source-maps', './artifacts/api-server/dist/index.mjs'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(apiPort),
      ADMIN_CLERK_USER_IDS: adminId,
    },
  });
  run('pnpm', ['--filter', '@workspace/construmarket-cr', 'run', 'dev'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(webPort),
      BASE_PATH: '/',
      API_TARGET: apiOrigin,
      VITE_E2E_MODE: 'true',
    },
  });
  await Promise.all([
    waitFor(`${apiOrigin}/api/healthz`),
    waitFor(baseUrl),
  ]);

  const browser = await chromium.launch({ headless: true });
  try {
    const professional = await session(browser, baseUrl, professionalId);
    const proPage = professional.page;
    await proPage.goto(`${baseUrl}/portal/profesional`);
    const profileName = proPage.getByLabel('Nombre / Firma');
    const profileCfia = proPage.getByLabel('Carné CFIA');
    const profileEmail = proPage.getByLabel('Correo electrónico de contacto');
    const profilePhone = proPage.getByLabel('Teléfono principal');
    const profileType = proPage.getByLabel('Tipo de profesional');
    const profileProvince = proPage.getByLabel('Provincia base');
    const profileBio = proPage.getByLabel('Biografía o experiencia');
    await tabTo(proPage, profileName);
    await profileName.fill(professionalName);
    await proPage.keyboard.press('Tab');
    await expect(profileCfia).toBeFocused();
    await profileCfia.fill(`CFIA-${unique}`);
    await proPage.keyboard.press('Tab');
    await expect(profileEmail).toBeFocused();
    await profileEmail.fill(professionalEmail);
    await proPage.keyboard.press('Tab');
    await expect(profilePhone).toBeFocused();
    await profilePhone.fill('88888888');
    await proPage.keyboard.press('Tab');
    await expect(profileType).toBeFocused();
    await proPage.keyboard.press('Enter');
    await proPage.keyboard.press('Home');
    await proPage.keyboard.press('Enter');
    await expect(profileType).toHaveText(/Arquitecto/);
    await tabTo(proPage, profileProvince);
    await proPage.keyboard.press('Enter');
    await proPage.keyboard.press('Home');
    await proPage.keyboard.press('Enter');
    await expect(profileProvince).toHaveText(/San José/);
    await tabTo(proPage, profileBio);
    await profileBio.fill('Perfil profesional único creado por la comprobación visual del piloto.');
    await proPage.keyboard.press('Tab');
    await expect(proPage.getByRole('button', { name: 'Guardar Perfil' })).toBeFocused();
    await proPage.keyboard.press('Enter');
    await expect(proPage.getByText('Perfil actualizado', { exact: true })).toBeVisible();
    await expect(proPage.getByText('En Revisión')).toBeVisible();

    const admin = await session(browser, baseUrl, adminId);
    const adminPage = admin.page;
    await adminPage.goto(`${baseUrl}/admin`);
    const summaryTab = adminPage.getByRole('tab', { name: 'Resumen' });
    const professionalsTab = adminPage.getByRole('tab', { name: /Profesionales/ });
    await tabTo(adminPage, summaryTab);
    await adminPage.keyboard.press('ArrowRight');
    await expect(professionalsTab).toBeFocused();
    await expect(professionalsTab).toHaveAttribute('aria-selected', 'true');
    const professionalCard = adminPage.getByTestId('professional-card').filter({ hasText: professionalName });
    await expect(professionalCard).toBeVisible();
    const approveProfessional = professionalCard.getByRole('button', { name: 'Aprobar CFIA' });
    await tabTo(adminPage, approveProfessional);
    await adminPage.keyboard.press('Enter');
    await expect(adminPage.getByText('Profesional actualizado', { exact: true })).toBeVisible();

    await proPage.goto(`${baseUrl}/portal/planos`);
    await checkNarrowLayout(proPage, 'Listado de diseños del profesional', [
      proPage.getByRole('link', { name: 'Volver al portal' }),
      proPage.getByRole('button', { name: 'Nuevo Diseño', exact: true }),
    ]);
    const newPlanButton = proPage.getByRole('button', { name: 'Nuevo Diseño', exact: true });
    await tabTo(proPage, newPlanButton);
    await proPage.keyboard.press('Enter');
    await checkNarrowLayout(proPage, 'Formulario de diseño', [
      proPage.getByRole('textbox').first(),
      proPage.getByRole('button', { name: 'Guardar Diseño' }),
      proPage.getByRole('button', { name: 'Cancelar' }),
    ]);
    const titleInput = proPage.getByLabel('Título del Diseño');
    const typeSelect = proPage.getByLabel('Tipo de Proyecto');
    await tabTo(proPage, titleInput);
    await proPage.keyboard.press('Tab');
    await expect(typeSelect).toBeFocused();
    await proPage.keyboard.press('Enter');
    await proPage.keyboard.press('Home');
    await proPage.keyboard.press('Enter');
    await expect(typeSelect).toHaveText(/Casa/);
    await titleInput.fill(title);
    const styleSelect = proPage.getByLabel('Estilo Arquitectónico');
    await tabTo(proPage, styleSelect);
    await proPage.keyboard.press('Enter');
    await proPage.keyboard.press('Home');
    await proPage.keyboard.press('Enter');
    await expect(styleSelect).toHaveText(/Tropical Moderno/);
    await proPage.getByLabel('Descripción del Proyecto').fill(
      'Diseño único creado desde el navegador para verificar todo el recorrido del piloto.',
    );
    const uploadInput = proPage.locator('input[type="file"]');
    const uploadLabel = proPage.locator('label').filter({ hasText: 'Agregar imágenes' });
    await tabToUpload(proPage, uploadInput, uploadLabel);
    const fileChooserPromise = proPage.waitForEvent('filechooser');
    await proPage.keyboard.press('Enter');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(planImagePath);
    await expect(proPage.getByLabel('Texto alternativo de imagen 1')).toBeVisible({ timeout: 15_000 });
    const savePlan = proPage.getByRole('button', { name: 'Guardar Diseño' });
    await tabTo(proPage, savePlan);
    await proPage.keyboard.press('Enter');
    await expect(proPage.getByText('Plano creado', { exact: true })).toBeVisible();
    const draftCard = proPage.getByTestId('my-plan-card').filter({ hasText: title });
    await expect(draftCard.getByText('draft')).toBeVisible();
    const editPlan = draftCard.getByRole('button', { name: 'Editar' });
    await tabTo(proPage, editPlan);
    await proPage.keyboard.press('Enter');
    const submitForReview = proPage.getByLabel('Enviar a revisión para publicar');
    await tabTo(proPage, submitForReview);
    await proPage.keyboard.press('Space');
    await expect(submitForReview).toBeChecked();
    await proPage.keyboard.press('Tab');
    await expect(proPage.getByRole('button', { name: 'Guardar Diseño' })).toBeFocused();
    await proPage.keyboard.press('Enter');
    await expect(proPage.getByText('Plano actualizado', { exact: true })).toBeVisible();
    await expect(proPage.getByTestId('my-plan-card').filter({ hasText: title }).getByText('pending')).toBeVisible();

    await adminPage.goto(`${baseUrl}/admin`);
    await checkNarrowLayout(adminPage, 'Pestañas de administración', [
      adminPage.getByRole('tab', { name: 'Resumen' }),
      adminPage.getByRole('tab', { name: /Profesionales/ }),
      adminPage.getByRole('tab', { name: /Diseños/ }),
      adminPage.getByRole('tab', { name: 'Leads' }),
    ]);
    const plansSummaryTab = adminPage.getByRole('tab', { name: 'Resumen' });
    const plansTab = adminPage.getByRole('tab', { name: /Diseños/ });
    await tabTo(adminPage, plansSummaryTab);
    await adminPage.keyboard.press('ArrowRight');
    await expect(adminPage.getByRole('tab', { name: /Profesionales/ })).toBeFocused();
    await adminPage.keyboard.press('ArrowRight');
    await expect(plansTab).toBeFocused();
    await expect(plansTab).toHaveAttribute('aria-selected', 'true');
    const planCard = adminPage.getByTestId('admin-plan-card').filter({ hasText: title });
    await expect(planCard).toBeVisible();
    await checkNarrowLayout(adminPage, 'Moderación de diseños', [
      planCard.getByRole('button', { name: 'Aprobar y Publicar' }),
      planCard.getByRole('button', { name: 'Rechazar' }),
    ]);
    const publishPlan = planCard.getByRole('button', { name: 'Aprobar y Publicar' });
    await tabTo(adminPage, publishPlan);
    await adminPage.keyboard.press('Space');
    await expect(adminPage.getByText('Plano actualizado', { exact: true })).toBeVisible();

    const publicContext = await browser.newContext(mobileContext);
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`${baseUrl}/catalogo`);
    const publicCard = publicPage.getByTestId('public-plan-card').filter({ hasText: title });
    await expect(publicCard).toBeVisible();
    const planLink = publicCard.getByRole('link');
    await tabTo(publicPage, planLink);
    await publicPage.keyboard.press('Enter');
    await expect(publicPage.getByRole('heading', { name: title })).toBeVisible();
    await checkNarrowLayout(publicPage, 'Formulario público de contacto', [
      publicPage.getByLabel('Nombre completo'),
      publicPage.getByRole('button', { name: 'Contactar Profesional' }),
    ]);
    const buyerName = publicPage.getByLabel('Nombre completo');
    const buyerEmailInput = publicPage.getByLabel('Correo electrónico');
    const buyerPhone = publicPage.getByLabel('Teléfono');
    const buyerProvince = publicPage.getByLabel('Dónde construirá');
    await tabTo(publicPage, buyerName);
    await publicPage.keyboard.press('Tab');
    await expect(buyerEmailInput).toBeFocused();
    await publicPage.keyboard.press('Tab');
    await expect(buyerPhone).toBeFocused();
    await publicPage.keyboard.press('Tab');
    await expect(buyerProvince).toBeFocused();
    await buyerName.fill(`Comprador ${unique}`);
    await buyerEmailInput.fill(buyerEmail);
    await buyerPhone.fill('87777777');
    await buyerProvince.press('Enter');
    await publicPage.getByRole('option', { name: 'Alajuela' }).press('Enter');
    await publicPage.getByLabel('Mensaje').fill('Quiero conocer más detalles de este diseño.');
    const contactProfessional = publicPage.getByRole('button', { name: 'Contactar Profesional' });
    await tabTo(publicPage, contactProfessional);
    await publicPage.keyboard.press('Enter');
    await expect(publicPage.getByText('¡Solicitud enviada!', { exact: true })).toBeVisible();

    await adminPage.goto(`${baseUrl}/admin`);
    const leadsSummaryTab = adminPage.getByRole('tab', { name: 'Resumen' });
    const leadsTab = adminPage.getByRole('tab', { name: 'Leads' });
    await tabTo(adminPage, leadsSummaryTab);
    await adminPage.keyboard.press('ArrowLeft');
    await expect(leadsTab).toBeFocused();
    await expect(leadsTab).toHaveAttribute('aria-selected', 'true');
    await expect(adminPage.getByText(buyerEmail)).toBeVisible();

    await Promise.all([professional.context.close(), admin.context.close(), publicContext.close()]);
    process.stdout.write(
      `Recorrido móvil con teclado completado en ${mobileContext.viewport.width}px, con comprobaciones críticas a ${narrowViewport.width}px y datos únicos ${unique}.\n`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  process.stderr.write(output);
  throw error;
} finally {
  await Promise.all(children.map(stop));
}