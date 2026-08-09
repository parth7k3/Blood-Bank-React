const puppeteer = require('puppeteer-core');
const os = require('os');
const path = require('path');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

(async () => {
  const browser = await puppeteer.launch({ 
    executablePath: CHROME_PATH, 
    headless: true,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:5173');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Logging in...");
  try {
    await page.type('#username', 'admin');
    await page.type('#password', 'admin123');
    await page.click('button[type="submit"]');
  } catch (e) {
    console.log("No login form found, assuming logged in.");
  }
  
  await new Promise(r => setTimeout(r, 2000));
  console.log("Clicking Blood Camps tab...");
  
  const tabs = await page.$$('div.menu-item');
  for (const tab of tabs) {
    const text = await page.evaluate(el => el.innerText, tab);
    if (text.includes('Blood Camps')) {
      await tab.click();
      console.log("Clicked Blood Camps tab!");
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
  console.log("Done");
})();
