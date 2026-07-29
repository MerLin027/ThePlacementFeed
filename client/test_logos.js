import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Wait for the dev server to be ready
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  console.log('Testing desktop view...');

  // 1. Check Favicon
  const favicon = await page.$('link[rel="icon"], link[rel="shortcut icon"]');
  const appleIcon = await page.$('link[rel="apple-touch-icon"]');
  if (favicon) {
      console.log('Favicon found: ', await favicon.getAttribute('href'));
  } else {
      console.log('Favicon NOT found!');
  }
  if (appleIcon) {
      console.log('Apple touch icon found: ', await appleIcon.getAttribute('href'));
  } else {
      console.log('Apple touch icon NOT found!');
  }

  // 2. Check Navbar Title Colors
  const theWord = await page.evaluate(() => {
    const el = document.querySelector('header span.text-brand-navy:nth-of-type(1)');
    return el ? window.getComputedStyle(el).color : null;
  });
  const placementWord = await page.evaluate(() => {
    const el = document.querySelector('header span.text-brand-blue');
    return el ? window.getComputedStyle(el).color : null;
  });
  const feedWord = await page.evaluate(() => {
    const el = document.querySelector('header span.text-brand-navy:nth-of-type(3)');
    return el ? window.getComputedStyle(el).color : null;
  });

  console.log(`Navbar Title Colors:
  "The" -> ${theWord} (Expected ~ rgb(3, 21, 54))
  "Placement" -> ${placementWord} (Expected ~ rgb(0, 90, 253))
  "Feed" -> ${feedWord} (Expected ~ rgb(3, 21, 54))`);

  // 3. Check Navbar Logo Image
  const navLogo = await page.$('header img');
  if (navLogo) {
      const src = await navLogo.getAttribute('src');
      console.log('Navbar logo image found, src:', src);
  } else {
      console.log('Navbar logo image NOT found!');
  }

  // 4. Check Footer Title Colors
  const footerTheWord = await page.evaluate(() => {
    const el = document.querySelector('footer span.text-brand-navy:nth-of-type(1)');
    return el ? window.getComputedStyle(el).color : null;
  });
  console.log(`Footer "The" Color -> ${footerTheWord}`);

  // 5. Check Footer Logos
  const footerLogos = await page.$$('footer img');
  console.log(`Found ${footerLogos.length} logos in footer (Expected 2).`);
  for (let i = 0; i < footerLogos.length; i++) {
      console.log(`Footer logo ${i+1} src:`, await footerLogos[i].getAttribute('src'));
  }

  // 6. Test Mobile View (Hamburger and Logo)
  console.log('\nTesting mobile view...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  
  const navLogoMobile = await page.$('header img');
  const isNavLogoVisible = await navLogoMobile.isVisible();
  console.log('Navbar logo visible on mobile:', isNavLogoVisible);

  await browser.close();
})();
