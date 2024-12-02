const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Set to false for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'], // Sandbox bypass for Linux
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36');

  try {
    // Navigate to Google Flights
    const url = 'https://www.google.com/flights';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Navigated to Google Flights');

    // Wait for any button on the left side
    const buttonSelector = 'button'; // Generic button selector for scanning
    await page.waitForSelector(buttonSelector, { timeout: 10000 });

    // Find buttons on the page and click the one that appears on the left
    const buttons = await page.$$(buttonSelector);
    let clicked = false;

    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box && box.x < page.viewport().width / 2) { // Assuming "left side" means x < half the viewport width
        console.log('Found button on the left side, attempting to click...');
        await button.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      console.error('No button found on the left side.');
    } else {
      console.log('Button clicked.');
    }

    // Wait to observe results
    await new Promise(r => setTimeout(r, 5000));
    console.log('Waited for 5 seconds after clicking.');

// Input "London" as the departure city
await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
  const departureInput = inputs.find(input => input.offsetLeft < window.innerWidth / 2);
  if (departureInput) {
    departureInput.value = 'London';
  }
});
console.log('Entered "London" as the departure city.');

// Input "France" as the destination city
await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
  const destinationInput = inputs.find(input => input.offsetLeft > window.innerWidth / 2);
  if (destinationInput) {
    destinationInput.value = 'France';
  }
});
console.log('Entered "France" as the destination.');

// Select a departure date
const departureDateSelector = '[aria-label="Departure"]';
await page.waitForSelector(departureDateSelector, { timeout: 10000 });
await page.click(departureDateSelector);
await page.keyboard.press('ArrowRight'); // Navigate to next month (optional)
await page.keyboard.press('Enter'); // Select a date
console.log('Selected a departure date.');

// Select a return date
const returnDateSelector = '[aria-label="Return"]';
await page.waitForSelector(returnDateSelector, { timeout: 10000 });
await page.click(returnDateSelector);
await page.keyboard.press('ArrowRight'); // Navigate further out
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
console.log('Selected a return date.');

// Scroll down the page by 10%
await page.evaluate(() => {
  window.scrollBy(0, window.innerHeight * 0.1); // Scrolls down 10% of the viewport height
});
console.log('Scrolled down the page by 10%.');

// Click the bottom-right corner of the page for the "Done" button
await page.evaluate(() => {
  const x = window.innerWidth - 10; // 10px from the right edge
  const y = window.innerHeight - 10; // 10px from the bottom edge
  const clickEvent = new MouseEvent('click', { bubbles: true, clientX: x, clientY: y });
  document.elementFromPoint(x, y)?.dispatchEvent(clickEvent);
});
console.log('Clicked the bottom-right corner of the page for the "Done" button.');

// Simulate clicking in the middle of the page for the "Explore" button
const { width, height } = await page.viewport();
//await page.mouse.click(width / 2, height / 2);
console.log('Simulated click in the middle of the page.');

// Locate the second "Explore" button and click it
await page.waitForSelector('button', { timeout: 10000 }); // Wait for buttons to load

const secondExploreButtonCoordinates = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const exploreButtons = buttons.filter(b => b.textContent.trim() === 'Explore');
  if (exploreButtons.length > 1) {
    const rect = exploreButtons[1].getBoundingClientRect(); // Get the second "Explore" button
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return null;
});

if (secondExploreButtonCoordinates) {
  console.log(`The second "Explore" button is at: (${secondExploreButtonCoordinates.x}px, ${secondExploreButtonCoordinates.y}px).`);
  await page.mouse.click(secondExploreButtonCoordinates.x, secondExploreButtonCoordinates.y);
  console.log('Clicked the second "Explore" button.');
} else {
  console.error('The second "Explore" button could not be found.');
}

// Wait for results to load
await new Promise(resolve => setTimeout(resolve, 10000));
console.log('Waited for 10 seconds to load results.');

const iframeSrc = await page.evaluate(() => {
  const iframe = document.querySelector('iframe');
  return iframe ? iframe.src : null;
});

if (iframeSrc) {
  console.log('Iframe src:', iframeSrc);
} else {
  console.log('Iframe not found.');
}

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
