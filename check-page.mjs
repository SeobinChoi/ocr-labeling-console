import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
page.on('console', msg => console.log('console', msg.type(), msg.text()));
page.on('pageerror', err => console.log('pageerror', err.message));
await page.goto('https://seobinchoi.github.io/ocr-labeling-console/?v=camel-images-3', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'page-screenshot.png', fullPage: true });
const info = await page.evaluate(() => ({
  title: document.title,
  body: document.body.innerText.slice(0, 3000),
  images: [...document.images].map(img => ({src: img.src, complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, clientWidth: img.clientWidth, clientHeight: img.clientHeight})),
  buttons: [...document.querySelectorAll('button,label.button')].map(b => b.textContent.trim()),
  storageKeys: Object.keys(localStorage),
}));
console.log(JSON.stringify(info, null, 2));
await browser.close();
