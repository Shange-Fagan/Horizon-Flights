const puppeteer = require('puppeteer');
const path = require('path');
const axios = require('axios');
const puppeteerExtra = require('puppeteer-extra');
const cors = require('cors')
const puppeteerExtraPluginStealth = require('puppeteer-extra-plugin-stealth');
const express = require('express');
const app = express();

app.use(cors({
  origin: [
    'http://localhost:5001', // local testing html page
    'https://shange-fagan.github.io', // GitHub Pages
    'https://horizonflights.org', // Production domain
    'http://localhost:3000', // local testing html backend
],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
  credentials: true, // Enable cookies/credentials if required
}));
/*const cors = require('cors')({
  origin: 'https://yourdomain.com', // Replace with your actual domain
  methods: ['GET', 'POST'], // Specify allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
});*/



app.get('/', (req, res) => res.send('Server is working!'));

// Start the server
// Add the stealth plugin to puppeteer-extra
puppeteerExtra.use(puppeteerExtraPluginStealth());


//const cors = require('cors')({ origin: true });
// Middleware
//app.use(cors());
//app.use(express.json());



// Serve static files from the public directory
//app.use(express.static(path.join(__dirname, 'public')));

// Handle the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Proper CORS setup
// Use CORS to allow requests from your frontend domain
// Allow CORS from your GitHub Pages domain
/*app.use(cors({
    origin: [
        'http://localhost:5001', // Allow requests from localhost
        'https://shange-fagan.github.io', // Frontend deployment domain
        'https://airbnbexplorer.com', // Your custom domain
        'https://api-omx7tvjdea-uc.a.run.app' // Your API domain
    ],
    methods: 'GET,POST',
    allowedHeaders: 'Content-Type,Authorization',
}));
app.options('*', cors()); // Enable preflight across all routes
*/
/*const corsConfig = cors({
  origin: [
    'http://localhost:5001', // Emulator
    'http://127.0.0.1:5001', // IP-based localhost
    'http://localhost:4000', // Emulator UI
    'https://shange-fagan.github.io', // GitHub Pages
    'https://airbnbexplorer.com', // Custom domain
    'https://api-omx7tvjdea-uc.a.run.app', // Cloud Run API
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
app.use(corsConfig);
app.options('*', (req, res) => {
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  });
app.options('*', corsConfig);*/
function waitForTimeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function navigateToPageWithRetry(page, url, maxRetries = 3) {
    let attempt = 0;
  
    while (attempt < maxRetries) {
        try {
            console.log(`Attempt ${attempt + 1} to load the page.`);
            // Navigate to the URL with an extended timeout
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 60000 // Set timeout to 60 seconds
            });
            console.log("Page loaded successfully.");
            return; // Exit the function if successful
        } catch (error) {
            attempt++;
            console.warn(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt >= maxRetries) {
                console.error("Failed to load the page after multiple attempts.");
                throw error; // Rethrow the error if max retries are exceeded
            }
            console.log("Retrying...");
        }
    }
  }
  
  // Function to solve reCAPTCHA using 2Captcha

async function solveRecaptcha(page) {
  // Find the CAPTCHA iframe
  const captchaIframe = await page.$('iframe[src*="recaptcha/api2/anchor"]');
  
  if (!captchaIframe) {
    console.error("No CAPTCHA iframe found!");
    return;
  }

  // Extract the iframe URL (which contains the site key)
  const captchaUrl = await captchaIframe.evaluate(frame => frame.src);
  
  // Extract the site key from the URL
  const urlParams = new URLSearchParams(captchaUrl.split('?')[1]);
  const siteKey = urlParams.get('k');  // Site key is in the 'k' parameter
  
  console.log("Captcha URL:", captchaUrl);
  console.log("Site Key:", siteKey);

  // Make sure the siteKey is extracted correctly
  if (!siteKey) {
    console.error("Failed to extract site key.");
    return;
  }

  // Define the action parameter (action can be customized based on your page context)
  const action = 'flights_submit'; // You can customize this based on the actual action happening on the page, like 'login' or 'search'
  console.log("Action set to:", action);

  // Use 2Captcha API to solve the CAPTCHA
  try {
    const response = await axios.post('http://2captcha.com/in.php', {
      key: '16c0c7f393fd4c7dba5da76441c5a008',  // Replace with your 2Captcha API key
      method: 'userrecaptcha',
      googlekey: siteKey,
      pageurl: captchaUrl,
      data: {
        action: action,  // Action parameter is required
      }
    });

    const captchaId = response.data.split('|')[1];
    console.log("Captcha ID:", captchaId);

    // Wait for the CAPTCHA solution from 2Captcha
    const result = await axios.get(`http://2captcha.com/res.php?key=16c0c7f393fd4c7dba5da76441c5a008&id=${captchaId}`);
    
    if (result.data.includes('OK')) {
      const captchaSolution = result.data.split('|')[1];
      console.log("Captcha solved:", captchaSolution);

      // Inject the solution into the reCAPTCHA response field
      await page.evaluate((solution) => {
        document.getElementById('g-recaptcha-response').innerText = solution;
      }, captchaSolution);

      // Click the search button after solving CAPTCHA
      const searchButtonSelector = '.mewtwo-flights-submit_button.mewtwo-flights-submit_button--new'; // Make sure the selector is correct
      await page.click(searchButtonSelector);
      console.log("Search button clicked after solving CAPTCHA.");
    } else {
      console.error("Failed to solve CAPTCHA:", result.data);
    }
  } catch (error) {
    console.error("Error solving CAPTCHA:", error);
  }
}
app.get('/getCityData', (req, res) => {
  const GEO_NAMES_USERNAME = "shange"; // Replace with your username
  const countryCode = req.query.countryCode || "NG"; // Default to Nigeria if not provided
  const maxRows = req.query.maxRows || 10;

  const url = `http://api.geonames.org/searchJSON`;

  try {
    const response = axios.get(url, {
      params: {
        country: countryCode,
        maxRows,
        featureClass: "P", // Populated places
        username: GEO_NAMES_USERNAME,
      },
    });

    const cities = response.data.geonames.map((city) => ({
      name: city.name,
      lat: parseFloat(city.lat),
      lng: parseFloat(city.lng),
    }));

    res.json({ country: countryCode, cities });
  } catch (error) {
    console.error("Error fetching city data:", error);
    res.status(500).json({ error: "Failed to fetch city data." });
  }
});

// Route to scrape flight data
app.get("/scrape-flights", async (req, res) => {
  const url = req.query.url || '';  // Ensure url is defined
const queryParams = new URLSearchParams(url.split('?')[1]);
const from = queryParams.get('from');
const to = queryParams.get('to');
const departureDate = queryParams.get('departureDate');
const returnDate = queryParams.get('returnDate');
const passengers = queryParams.get('passengers');
const cabinClass = queryParams.get('cabinClass');

console.log("Parsed Parameters:");
    console.log("From:", from);
    console.log("To:", to);
    console.log("Departure Date:", departureDate);
    console.log("Return Date:", returnDate);
    console.log("Passengers:", passengers);
    console.log("Cabin Class:", cabinClass);

  console.log("Query parameters received:", req.query);
  if (!from || !to) {
    console.error("Missing 'from' or 'to' query parameters.");
    res.status(400).json({ error: "'from' and 'to' parameters are required" });
    return;
}
  try {
    const url = `https://www.trivagoflight.in/flights/`;

  console.log("Generated URL:", url);

  // Launch Puppeteer
  // Launch Puppeteer with stealth mode enabled
  const browser = await puppeteerExtra.launch({
    headless: true,  // Set to false if you want to see the browser for debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  const page = await browser.newPage();

  // Navigate to Trivago Flights main page
  // Navigate to the Airbnb search results page
  await navigateToPageWithRetry(page, url);


  await page.setViewport({ width: 1280, height: 720 });
  // Wait for results to load
await new Promise(resolve => setTimeout(resolve, 5000));
console.log('Waited for 10 seconds to load results.');
  // Define the selector for the input field
const fromInputSelector = 'input[placeholder="Origin"]'; // Replace with your actual selector

// Use page.evaluate to clear the input field
await page.evaluate((selector) => {
  const input = document.querySelector(selector);
  if (input) {
    input.value = ''; // Clear the input field programmatically
    input.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event to ensure UI updates
  }
}, fromInputSelector);

// Type the new "From" value
await page.type(fromInputSelector,(from)); // Replace 'London' with your desired value
console.log(`Entered "${from}" as the from location.`);

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Input "To" field
  await page.click('input[placeholder="Destination"]'); // Use the actual selector
  await page.keyboard.type(to); // Type the "To" value
  console.log(`Entered "${to}" as the destination city.`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Function to select a specific date by clicking the calendar cell
async function selectDate(page, date) {
  const dateSelector = '.mewtwo-datepicker-table'; // Calendar table container class
  const dateCellSelector = `td[data-date="${date}"]`; // Dynamic selector for the specific date

  // Wait for the calendar table to appear
  await page.waitForSelector(dateSelector);

  // Click on the date cell
  await page.evaluate((selector) => {
    const dateCell = document.querySelector(selector);
    if (dateCell) {
      dateCell.click(); // Simulate a click on the desired date
    }
  }, dateCellSelector);

  console.log(`Selected date: ${date}`);
}
  // Input "Departure Date"
  await page.click('input[placeholder="Depart date"]'); // Use the actual selector
await selectDate(page, departureDate);
  console.log(`Selected "${departureDate}" as the departure date.`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Define the coordinates of the blank part of the page (adjust as per your page layout)
const blankPartX = 200; // X coordinate of the blank space
const blankPartY = 500; // Y coordinate of the blank space

// Click the blank part of the page
// Select a blank part of the page by a safe selector (for example, the body or a specific div with no functionality)
const clickAwaySelector =  '.TPWL-header-content'
await page.waitForSelector(clickAwaySelector, { visible: true });
// Click the passenger selection button
await page.evaluate((selector) => {
  const button = document.querySelector(selector);
  if (button) {
    button.click();
  }
}, clickAwaySelector);
console.log('Clicked on the blank part of the page to ensure proper date selection.');
await new Promise(resolve => setTimeout(resolve, 5000));

  // Input "Return Date"
  await page.click('input[placeholder="Return date"]'); // Use the actual selector
  await selectDate(page, returnDate);
  console.log(`Selected "${returnDate}" as the return date.`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Wait for the page to load and target the passenger selection button
const passengerButtonSelector = '.mewtwo-flights-trip_class-wrapper'; // Button to open the passenger modal
await page.waitForSelector(passengerButtonSelector, { visible: true });

// Click the passenger selection button
await page.evaluate((selector) => {
  const button = document.querySelector(selector);
  if (button) {
    button.click();
  }
}, passengerButtonSelector);
console.log('Clicked the passenger selection button.');

// Ensure the modal is fully opened (add a delay if necessary)
await new Promise(resolve => setTimeout(resolve, 5000));
// Wait for the page to load and target the passenger selection button
// Wait for the page to load and target the passenger selection button

// Selector for the "Add Passenger" button
const incrementPassengersSelector = '.mewtwo-popup-ages-counter__plus';
await page.waitForSelector(incrementPassengersSelector, { visible: true });

// Increment passenger count to the desired number
const passengersToAdd = passengers - 1; // Number of passengers to add (current passengers - 1)
for (let i = 0; i < passengersToAdd; i++) {
  await page.evaluate((selector) => {
    const button = document.querySelector(selector);
    if (button) {
      button.click();
    }
  }, incrementPassengersSelector);
  console.log(`Added passenger ${i + 1}`);
}

console.log('Incremented the passenger count.');



// Select a blank part of the page by a safe selector (for example, the body or a specific div with no functionality)
await page.waitForSelector(clickAwaySelector, { visible: true });
// Click the passenger selection button
await page.evaluate((selector) => {
  const button = document.querySelector(selector);
  if (button) {
    button.click();
  }
}, clickAwaySelector);
console.log('Clicked on the blank part of the page to ensure proper date selection.');

try {
  // Log the cabin class for debugging
  console.log('Cabin class received:', cabinClass);

  // Select the Business Class checkbox if needed
  if (cabinClass === 'business') {
    const businessClassCheckboxSelector = '.mewtwo-passengers-flight_type__checkbox'; // Update based on the actual selector
    await page.waitForSelector(businessClassCheckboxSelector, { visible: true }); // Wait for the checkbox to be visible

    const isChecked = await page.evaluate((selector) => {
      const checkbox = document.querySelector(selector);
      return checkbox ? checkbox.checked : false; // Ensure checkbox exists before checking
    }, businessClassCheckboxSelector);

    if (!isChecked) {
      await page.click(businessClassCheckboxSelector); // Check the Business Class box
      console.log('Selected Business Class.');
    } else {
      console.log('Business Class already selected.');
    }
  } else {
    console.log('Economy Class selected by default.');
  }

  // Proceed to click the search button
  const searchButtonSelector = '.mewtwo-flights-submit_button.mewtwo-flights-submit_button--new'; // Ensure the selector is correct
  await page.waitForSelector(searchButtonSelector, { visible: true }); // Wait for the button to be visible

  await page.click(searchButtonSelector);
  await new Promise(resolve => setTimeout(resolve, 35000));

await new Promise(resolve => setTimeout(resolve, 5000));
const currentUrlBeforeSearch = page.url();
// Capture HTML content to check if reCAPTCHA is present
const pageContent = await page.content();
console.log(pageContent);  // This logs the HTML content of the page to the console.
console.log("Current URL before pressing the search button:", currentUrlBeforeSearch);
 // Check if CAPTCHA is present
 /*const captchaFrame = await page.$('iframe[src*="recaptcha"]');
 if (captchaFrame) {
   console.log("CAPTCHA detected, solving...");
   await solveRecaptcha(page, captchaFrame);
 }*/
  //await page.click(searchButtonSelector);  // After solving the CAPTCHA, click the search button
  console.log('Search button clicked.');
} catch (error) {
  console.error('Error handling cabin class or clicking search button:', error);
}

await new Promise(resolve => setTimeout(resolve, 15000));

// Wait for the flight results container to load
// Wait for the tickets container to load
await page.waitForSelector('.tickets-container.js-tickets-container', { timeout: 60000 });
await page.screenshot({ path: 'screenshot-before-search.png' });
// Scrape flight data for all tickets
const results = await page.evaluate(() => {
  const flights = [];
  
  // Query all tickets with `role="ticket-container"`
  const ticketItems = document.querySelectorAll('[role="ticket-container"]');
  
  ticketItems.forEach((item) => {
    const airline = item.querySelector('.ticket-action__main_proposal')?.innerText || "N/A";
    const departureTime = item.querySelector('.flight.flight--depart .flight-brief-departure .flight-brief-time')?.innerText || "N/A";
    const returnTime = item.querySelector('.flight.flight--return .flight-brief-departure .flight-brief-time')?.innerText || "N/A";
    const layoverTime = item.querySelector('.flight-brief-layovers__flight_time')?.innerText || "N/A";
    const price = item.querySelector('.currency_font.currency_font--usd')?.innerText || "N/A";
    const link = item.querySelector('.ticket-action-button-deeplink.ticket-action-button-deeplink--')?.href || "N/A";

    flights.push({
      airline,
      departureTime,
      returnTime,
      layoverTime,
      price,
      link,
    });
  });

  return flights;
});

console.log("Scraped flight results:", results);

// Close the browser
await browser.close();


    // Return scraped data
    res.json({ success: true, flights: results });
  } catch (error) {
    console.error("Error scraping flights:", error);
    res.status(500).json({ success: false, error: "Failed to scrape flights" });
  }
});
// Airbnb Scraping based on searchUrl (Original code)
async function scrapeAirbnbPosts(searchUrl) {
  try {
    const browser = await puppeteer.launch({ headless: true,  args: ['--no-sandbox', '--disable-setuid-sandbox'],});
    const page = await browser.newPage();

    // Navigate to the Airbnb search results page
    await navigateToPageWithRetry(page, searchUrl);

  
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['stylesheet', 'font'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    // Scrape the post elements (titles, images, prices, etc.)
    const posts2 = await page.evaluate(() => {
      const postElements = [...document.querySelectorAll('[data-testid="listing-card-title"]')].map((post, index) => {
        const subtitleElement = document.querySelectorAll('[data-testid="listing-card-subtitle"]')[index];
        const subtitleNameElement = document.querySelectorAll('[data-testid="listing-card-name"]')[index];
        const priceElement = document.querySelectorAll('[data-testid="price-availability-row"]')[index];
        // Select only the first image from the listing carousel
        const imgElement = document.querySelectorAll('picture source[srcset]')[index];
        const imageUrl = imgElement ? imgElement.getAttribute('srcset').split(' ')[0] : '';
        const linkElement = document.querySelectorAll('a[aria-hidden="true"]')[index];
        const ratingElement = document.querySelectorAll('.t1a9j9y7.atm_da_1ko3t4y.atm_dm_kb7nvz.atm_fg_h9n0ih.dir.dir-ltr')[index];

        // Extract and clean the price
    const listingPriceDetails = priceElement?.textContent?.trim() || '';
    const priceMatch = listingPriceDetails.match(/£\d+/); // Extract only the first number with £
    const cleanedPrice = priceMatch ? priceMatch[0] : 'N/A';

    // Extract and clean the rating text to display only "4.91 out of 5"
    const ratingDetails = ratingElement?.textContent || '';
    const cleanedRating = ratingDetails.match(/[\d.]+\sout\s(of)\s5/)?.[0] || 'N/A'; // Extract only "4.91 out of 5"

        return {
          images: imageUrl,
          title: post.innerText,
          subtitle: subtitleElement ? subtitleElement.innerText : null,
          listing_name: subtitleNameElement ? subtitleNameElement.innerText : null,
          listing_price_details: cleanedPrice ? cleanedPrice : null,
          rating_out_of_5_stars: cleanedRating ? cleanedRating : null,
          link: linkElement ? linkElement.href : null
        };
    });
      return postElements;
    });
    await browser.close();
    return posts2;
  } catch (err) {
    console.error('Error scraping Airbnb posts:', err);
    return [];
  }
}
app.get('/scrape-airbnb', async (req, res) => {
  //const { location, category, checkin, checkout, guests } = req.query;
 // Default search URL for Airbnb
 // Construct the initial Airbnb URL (without map bounds)
  // Get today's date
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);
 // Get the first day of the current month
const monthlyStartDate = new Date(today.getFullYear(), today.getMonth(), 1);

// Get the end date three months from the current month
const monthlyEndDate = new Date(today.getFullYear(), today.getMonth() + 3, 0); // 0 gives the last day of the previous month
// Format the dates to YYYY-MM-DD
const monthlyStart = monthlyStartDate.toISOString().split('T')[0];  // First day of current month
const monthlyEnd = monthlyEndDate.toISOString().split('T')[0];  // Last day of the month 3 months from now

 
const { searchUrl, category } = req.query;
// Parse the searchUrl to extract the query parameters
const parsedUrl = new URL(searchUrl);
const location = parsedUrl.pathname.split('/')[2]; // Extract 'location' from the path
const checkin = parsedUrl.searchParams.get('checkin');
const checkout = parsedUrl.searchParams.get('checkout');
const guests = parsedUrl.searchParams.get('adults');
//const monthly_start = parsedUrl.searchParams.get('monthlyStart');
//const monthly_end = parsedUrl.searchParams.get('monthlyEnd');

console.log(`Location: ${location}, Checkin: ${checkin}, Checkout: ${checkout}, Guests: ${guests}`);

// Use these parameters to build your final search URL
let finalSearchUrl = `https://www.airbnb.com/s/${location}/homes?tab_id=home_tab&refinement_paths%5B%5D=%2Fhomes&adults=${guests}&flexible_trip_lengths%5B%5D=one_week&monthly_start_date=${monthlyStart}&monthly_length=3&monthly_end_date=${monthlyEnd}&price_filter_input_type=0&channel=EXPLORE&date_picker_type=calendar&checkin=${checkin}&checkout=${checkout}&source=structured_search_input_header&search_type=unknown&price_filter_num_nights=1&drawer_open=true`;

console.log(`Generated URL: ${finalSearchUrl}`);
//let searchUrl = `https://www.airbnb.com/s/${location}/homes?tab_id=home_tab&refinement_paths%5B%5D=%2Fhomes&adults=2&flexible_trip_lengths%5B%5D=one_week&monthly_start_date=${monthlyStart}&monthly_length=3&monthly_end_date=${monthlyEnd}&price_filter_input_type=0&channel=EXPLORE&date_picker_type=calendar&checkin=${checkin}&checkout=${checkout}&adults=${guests}&source=structured_search_input_header&search_type=unknown&price_filter_num_nights=1&drawer_open=true`;
  console.log(`Scraping Airbnb posts for URL: ${finalSearchUrl}`);  // Log the URL for debugging
  const posts2 = await scrapeAirbnbPosts(finalSearchUrl);  // Pass the dynamic URL to the scraping function
  console.log('Scraped posts: ', posts2);
  //res.json(posts);  // Send the scraped posts back as JSON response
  // Add filters based on category
  switch (category) {
    case 'popular':
      // No additional filter needed for 'popular', just return regular search results
      break;
    case 'cheapest':
      searchUrl += `&price_min=1`; // This is a placeholder for cheapest filter
      break;
      case 'mid-price':
      searchUrl += `&price_min=50&price_max=200`; // Mid-price range (adjust as needed)
      break;
    case 'expensive':
      searchUrl += `&price_max=10000`; // Placeholder for expensive filter (you might need to modify this)
      break;
    // Add other categories as necessary
    default:
      break;
  }

console.log(`Generated URL: ${finalSearchUrl}`);
  // Extract the map bounds and zoom level from the initial Airbnb URL
  const { mapBounds, zoomLevel } = await extractBoundsFromUrl(finalSearchUrl);
  // Scrape the pixel coordinates of the markers
  const markers = await scrapeAirbnbMapMarkers(finalSearchUrl);

  if (!Array.isArray(markers)) {
    console.error("Markers is not an array:", markers);
    return res.status(500).json({ error: "Markers is not an array" });
  }

  if (!mapBounds || isNaN(zoomLevel)) {
    res.status(500).json({ error: 'Failed to fetch map bounds' });
    return;
  }
   // Construct the final Airbnb URL with map bounds and zoom level
   finalSearchUrl += `&ne_lat=${mapBounds.northeast.lat}&ne_lng=${mapBounds.northeast.lng}&sw_lat=${mapBounds.southwest.lat}&sw_lng=${mapBounds.southwest.lng}&zoom=${zoomLevel}&zoom_level=${zoomLevel}&search_by_map=true`;
   console.log('Navigating to final URL:', finalSearchUrl);
console.log('Map bounds:', mapBounds);
  console.log('Zoom Level:', zoomLevel);
  console.log('Marker positions:', markers);
    

  // Convert each pixel marker to lat/lng
  // Convert all marker pixel positions to lat/lng
  const mapWidth = 1024;
  const mapHeight = 768;
// Convert all marker pixel positions to lat/lng with scaling
const scaleFactor = 3; // Adjust this factor as needed
const markerLatLngs = markers.map(marker => pixelToLatLng(marker.left, marker.top, mapBounds, mapWidth, mapHeight, scaleFactor));

console.log('Converted Marker Lat/Lng with Scaling:', markerLatLngs);
console.log('Scraping completed, posts fetched: ', posts2.length);
  // Send the lat/lng markers as JSON response
  //res.json(markerLatLngs);
  
  
    if (!Array.isArray(posts2)) {
        throw new Error('Posts should be an array');
    }
  res.json({
    posts2,       // The Airbnb posts
    markers: markerLatLngs  // The converted marker coordinates
  })
});
// Airbnb Scraping based on region and category (New functionality)

// Function to scrape pixel positions of Airbnb markers

async function simulateMouseDrag(page, startX, startY, endX, endY) {
  // Move the mouse to the start position
  await page.mouse.move(startX, startY);

  // Simulate mouse down (click and hold)
  await page.mouse.down();

  // Simulate the drag to the end position
  await page.mouse.move(endX, endY, { steps: 10 }); // Adjust 'steps' for smoothness

  // Simulate mouse up (release the click)
  await page.mouse.up();
}

async function clickAcceptCookiesButton(page) {
  try {
      // Retrieve all buttons and their text
      const buttons = await page.$$eval('button', (btns) => btns.map((btn) => btn.textContent.trim()));

      // Find the index of the "Accept all" button
      const acceptCookiesButtonIndex = buttons.findIndex((button) =>
          button.toLowerCase().includes('accept all')
      );

      if (acceptCookiesButtonIndex !== -1) {
          // Construct a selector based on the button's position in the DOM
          const buttonSelector = `button:nth-of-type(${acceptCookiesButtonIndex + 1})`;

          // Wait for the button and click it
          await page.waitForSelector(buttonSelector, { timeout: 30000 });
          const button = await page.$(buttonSelector);

          if (button) {
              await button.click();
              console.log("Clicked 'Accept Cookies' button.");
          } else {
              console.warn("'Accept Cookies' button not found.");
          }
      } else {
          console.warn("'Accept Cookies' button text not found.");
      }
  } catch (error) {
      console.error("Error clicking 'Accept Cookies' button:", error.message);
  }
}

// Function to scrape location information from Airbnb and fetch bounds from Google Maps
async function extractBoundsFromUrl(searchUrl) {
  const browser = await puppeteer.launch({ headless: true,  args: ['--no-sandbox', '--disable-setuid-sandbox'],});
  const page = await browser.newPage();

  
  // Call the retry function to navigate to the page
  await navigateToPageWithRetry(page, searchUrl);
  await page.evaluate(() => {
  // Select the popup container
const popup = document.querySelector('div.c8qah1m.atm_9s_11p5wf0.atm_h_1h6ojuz');

// Select the close button within the popup using its class
const closeButton = popup ? popup.querySelector('button.cd570ix.atm_d2_1bvjyxt.atm_gz_exct8b.atm_j_v2br90') : null;

// Click the close button
if (closeButton) {
    closeButton.click();
    console.log('Popup closed successfully.');
} else {
    console.log('Close button not found.');
}
  })
  await page.evaluate(() => {
    // Select the popup container
  const popup2 = document.querySelector('div.tw5hock atm_c8_2x1prs atm_g3_1jbyh58 atm_fr_11a07z3 atm_cs_wp830q dir dir-ltr');
  
  // Select the close button within the popup using its class
  const closeButton = popup2 ? popup2.querySelector('button.b1rrt7c2 atm_mk_h2mmj6 atm_vy_l52nlx atm_e2_l52nlx atm_gi_idpfg4 atm_l8_idpfg4 atm_3f_glywfm atm_5j_1ssbidh atm_26_1j28jx2 atm_9j_tlke0l atm_tl_1gw4zv3 atm_7l_3ha9i4 atm_kd_glywfm atm_92_1yyfdc7_vmtskl atm_9s_1ulexfb_vmtskl atm_mk_stnw88_vmtskl atm_tk_1ssbidh_vmtskl atm_fq_1ssbidh_vmtskl atm_tr_pryxvc_vmtskl atm_vy_1tcgj5g_vmtskl atm_e2_1tcgj5g_vmtskl atm_5j_1ssbidh_vmtskl atm_3f_glywfm_jo46a5 atm_l8_idpfg4_jo46a5 atm_gi_idpfg4_jo46a5 atm_3f_glywfm_1icshfk atm_kd_glywfm_19774hq atm_uc_aaiy6o_1w3cfyq atm_uc_glywfm_1w3cfyq_1rrf6b5 atm_70_13xi5zr_9xuho3 atm_uc_aaiy6o_pfnrn2_1oszvuo atm_uc_glywfm_pfnrn2_1o31aam atm_70_13xi5zr_1buez3b_1oszvuo dir dir-ltr') : null;
  
  // Click the close button
  if (closeButton) {
      closeButton.click();
      console.log('Popup closed successfully.');
  } else {
      console.log('Close button not found.');
  }
    })
  // Targeting the button by its visible text 'Show map'
  await page.waitForSelector('button', { visible: true });
  console.log("'Accept all' button clicked successfully.");
  const buttons = await page.$$eval('button', buttons => 
    buttons.map(button => button.innerText.trim())
  );
  const acceptCookiesButtonIndex = buttons.findIndex(button => button.includes('Accept all'));

  /*if (acceptCookiesButtonIndex !== -1) {
    // Click on the button that contains 'Show map' text
    const buttonsSelector = await page.$$('button');
    console.log('Clicking "Accept Cookies" button');
    await buttonsSelector[acceptCookiesButtonIndex].click();
    await waitForTimeout(5000); // Wait for the map to load after clicking
  }*/
 // Click the "Accept Cookies" button
 await clickAcceptCookiesButton(page);

  const showMapButtonIndex = buttons.findIndex(button => button.includes('Show map'));
  
  if (showMapButtonIndex !== -1) {
    // Click on the button that contains 'Show map' text
    const buttonsSelector = await page.$$('button');
    console.log('Clicking "Show map" button');
    await buttonsSelector[showMapButtonIndex].click();
    await waitForTimeout(30000); // Wait for the map to load after clicking
  } else {
    console.log('Could not find "Show map" button.');
  }
  await waitForTimeout(5000);
  // Simulate dragging the map (moving it slightly)
  // Wait for the map container to be visible
  await page.waitForSelector('div[data-testid="map/GoogleMap"]', { visible: true });

  // Simulate dragging the map (start and end coordinates)
  await simulateMouseDrag(page, 300, 200, 305, 215); // Adjust coordinates based on map size
  await simulateMouseDrag(page, 305, 215, 300, 215);
  await simulateMouseDrag(page, 300, 215, 310, 215);
  await simulateMouseDrag(page, 300, 215, 310, 230);
  // Wait for the map to update
  await waitForTimeout(5000);

  // Extract the updated URL
  const newUrl = page.url();
  console.log('New URL after dragging the map:', newUrl);
  // Targeting the button by its visible text 'Show map'

  // Step 2: Use Google Maps to search for the same location
// Function to scrape Google Maps for bounds based on a centered location

 // Function to get the map bounds from the Airbnb map (without Google Maps API)
 // Wait for the map container with data-testid="map/GoogleMap"
 //await page.waitForSelector('div[data-testid="map/GoogleMap"]');

// Execute script to access the map object and get bounds
// Create a URL object
// Function to scrape Airbnb for generated URL based on region
// Automatically click on the first marker
// Wait for the marker divs to load
  // Extract bounds and zoom from the generated URL
  const parsedUrl = new URL(newUrl);

  // Extract map bounds and zoom level
  const mapBounds = {
    northeast: {
      lat: parseFloat(parsedUrl.searchParams.get("ne_lat")),
      lng: parseFloat(parsedUrl.searchParams.get("ne_lng")),
    },
    southwest: {
      lat: parseFloat(parsedUrl.searchParams.get("sw_lat")),
      lng: parseFloat(parsedUrl.searchParams.get("sw_lng")),
    },
  };

  const zoomLevel = parseFloat(parsedUrl.searchParams.get("zoom"));

  console.log('Map Bounds:', mapBounds);
  console.log('Zoom Level:', zoomLevel);
  await browser.close();
  // Return the map bounds and zoom level
  return { mapBounds, zoomLevel };
}
// Function to scrape pixel positions of Airbnb markers
async function scrapeAirbnbMapMarkers(searchUrl) {
  const browser = await puppeteer.launch({ headless: true,  args: ['--no-sandbox', '--disable-setuid-sandbox'],});
  const page = await browser.newPage();

  // Navigate to Airbnb map page
  await navigateToPageWithRetry(page, searchUrl);
  await page.evaluate(() => {
  // Select the popup container
const popup = document.querySelector('div.c8qah1m.atm_9s_11p5wf0.atm_h_1h6ojuz');

// Select the close button within the popup using its class
const closeButton = popup ? popup.querySelector('button.cd570ix.atm_d2_1bvjyxt.atm_gz_exct8b.atm_j_v2br90') : null;

// Click the close button
if (closeButton) {
    closeButton.click();
    console.log('Popup closed successfully.');
} else {
    console.log('Close button not found.');
}
  })
  await page.evaluate(() => {
    // Select the popup container
  const popup2 = document.querySelector('div.tw5hock atm_c8_2x1prs atm_g3_1jbyh58 atm_fr_11a07z3 atm_cs_wp830q dir dir-ltr');
  
  // Select the close button within the popup using its class
  const closeButton = popup2 ? popup2.querySelector('button.b1rrt7c2 atm_mk_h2mmj6 atm_vy_l52nlx atm_e2_l52nlx atm_gi_idpfg4 atm_l8_idpfg4 atm_3f_glywfm atm_5j_1ssbidh atm_26_1j28jx2 atm_9j_tlke0l atm_tl_1gw4zv3 atm_7l_3ha9i4 atm_kd_glywfm atm_92_1yyfdc7_vmtskl atm_9s_1ulexfb_vmtskl atm_mk_stnw88_vmtskl atm_tk_1ssbidh_vmtskl atm_fq_1ssbidh_vmtskl atm_tr_pryxvc_vmtskl atm_vy_1tcgj5g_vmtskl atm_e2_1tcgj5g_vmtskl atm_5j_1ssbidh_vmtskl atm_3f_glywfm_jo46a5 atm_l8_idpfg4_jo46a5 atm_gi_idpfg4_jo46a5 atm_3f_glywfm_1icshfk atm_kd_glywfm_19774hq atm_uc_aaiy6o_1w3cfyq atm_uc_glywfm_1w3cfyq_1rrf6b5 atm_70_13xi5zr_9xuho3 atm_uc_aaiy6o_pfnrn2_1oszvuo atm_uc_glywfm_pfnrn2_1o31aam atm_70_13xi5zr_1buez3b_1oszvuo dir dir-ltr') : null;
  
  // Click the close button
  if (closeButton) {
      closeButton.click();
      console.log('Popup closed successfully.');
  } else {
      console.log('Close button not found.');
  }
    })
  // Targeting the button by its visible text 'Show map'
  await page.waitForSelector('button', { visible: true });

  const buttons = await page.$$eval('button', buttons => 
    buttons.map(button => button.innerText.trim())
  );
  const acceptCookiesButtonIndex = buttons.findIndex(button => button.includes('Accept all'))

  /*if (acceptCookiesButtonIndex !== -1) {
    // Click on the button that contains 'Show map' text
    const buttonsSelector = await page.$$('button');
    console.log('Clicking "Accept Cookies" button');
    await buttonsSelector[acceptCookiesButtonIndex].click();
    await waitForTimeout(5000); // Wait for the map to load after clicking
  } else {
    console.log('Could not find "Accept Cookies" button.');
  }*/
  const showMapButtonIndex = buttons.findIndex(button => button.includes('Show map'));
  
  if (showMapButtonIndex !== -1) {
    // Click on the button that contains 'Show map' text
    const buttonsSelector = await page.$$('button');
    console.log('Clicking "Show map" button');
    await buttonsSelector[showMapButtonIndex].click();
    await waitForTimeout(5000); // Wait for the map to load after clicking
  } else {
    console.log('Could not find "Show map" button.');
  }
// Simulate dragging the map (start and end coordinates)
await simulateMouseDrag(page, 300, 200, 305, 215); // Adjust coordinates based on map size
await simulateMouseDrag(page, 305, 215, 300, 215);
await simulateMouseDrag(page, 300, 215, 310, 215);
await simulateMouseDrag(page, 300, 215, 310, 230);
// Wait for the map to update
await waitForTimeout(5000);

  // Wait for the marker divs to load
    try {
    await waitForTimeout(5000);
    console.log('Looking for markers...');
    await page.waitForSelector('div[style*="position: absolute"]', { timeout: 10000 });
    
    // Extract marker pixel positions from the map
    console.log('Looking for markers...');
    const markers = await page.evaluate(() => {
      const markerElements = document.querySelectorAll('div[style*="position: absolute"]');
      console.log('Found marker elements:', markerElements.length);
      const markersData = [];

      markerElements.forEach(marker => {
        const style = marker.getAttribute('style');
        const transformMatch = style.match(/transform:\s*translate\((-?\d+(\.\d+)?)px,\s*(-?\d+(\.\d+)?)px\)/);

        if (transformMatch) {
          const left = parseFloat(transformMatch[1]);
          const top = parseFloat(transformMatch[3]);
          // Filter out unwanted markers: (left 0, top 0), (left 1, top 1), (left 24, top 24), (left 50, top 50), and (left 64, top 24)
          // Filter out unwanted markers based on custom rules
          if ((left !== 0 && left !== 1 && left !== 24 && left !== 50 && left !== 64) || (top !== 0 && top !== 1 && top !== 24 && top !== 50)) {
            markersData.push({ left, top });
          }
        }
      });

      console.log('Scraped markers data:', markersData); // Log the scraped data
      return markersData;
    });
    console.log('Markers found:', markers);
    await browser.close();
    return markers;
  } catch (error) {
    console.log('Error finding markers:', error);
    await browser.close();
    return [];
  }
}
// Function to convert pixel positions to latitude and longitude
// Function to convert pixel positions to latitude and longitude with scaling
function pixelToLatLng(pixelX, pixelY, mapBounds, mapWidth = 1024, mapHeight = 768, scaleFactor = 3) {
  if (!mapBounds || !mapBounds.northeast || !mapBounds.southwest) {
    console.error('Invalid map bounds for pixel-to-lat/lng conversion');
    return null;
  }

  // Calculate the latitude and longitude range, scaled down by the scaleFactor
  const latRange = (mapBounds.northeast.lat - mapBounds.southwest.lat) / scaleFactor;
  const lngRange = (mapBounds.northeast.lng - mapBounds.southwest.lng) / scaleFactor;
  const latitudeAdjustment = 9.5; // Adjust this value as needed
  // Convert pixelX and pixelY to latitude and longitude
  const lat = mapBounds.southwest.lat + (pixelY / mapHeight) * latRange + latitudeAdjustment;
  //const lng = mapBounds.southwest.lng + (pixelX / mapWidth) * lngRange;
// Adjust longitude by a small value (e.g., 5 degrees to the right)
const longitudeAdjustment = 30.5; // Adjust this value as needed
const lng = mapBounds.southwest.lng + (pixelX / mapWidth) * lngRange + longitudeAdjustment;

  return { lat, lng };
}
// Express route to scrape Airbnb markers and convert them to lat/lng
app.get('/get-markers', async (req, res) => {
  const { region, category, guests } = req.query; // Get region and category from query params
  // Construct the initial Airbnb URL (without map bounds)
  // Get today's date
const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);

// Get the first day of the current month
const monthlyStartDate = new Date(today.getFullYear(), today.getMonth(), 1);

// Get the end date three months from the current month
const monthlyEndDate = new Date(today.getFullYear(), today.getMonth() + 3, 0); // 0 gives the last day of the previous month

// Format the dates to YYYY-MM-DD
const checkin = today.toISOString().split('T')[0];  // Today's date in YYYY-MM-DD format
const checkout = tomorrow.toISOString().split('T')[0];  // Tomorrow's date in YYYY-MM-DD format
const monthlyStart = monthlyStartDate.toISOString().split('T')[0];  // First day of current month
const monthlyEnd = monthlyEndDate.toISOString().split('T')[0];  // Last day of the month 3 months from now

// Construct the URL with dynamic dates
let searchUrl = `https://www.airbnb.com/s/${region}/homes?tab_id=home_tab&refinement_paths%5B%5D=%2Fhomes&adults=2&flexible_trip_lengths%5B%5D=one_week&monthly_start_date=${monthlyStart}&monthly_length=3&monthly_end_date=${monthlyEnd}&price_filter_input_type=0&channel=EXPLORE&date_picker_type=calendar&checkin=${checkin}&checkout=${checkout}&adults=${guests}&source=structured_search_input_header&search_type=unknown&price_filter_num_nights=1&drawer_open=true`;

console.log(`Generated URL: ${searchUrl}`);

  //let url2 = `https://www.airbnb.com/s/${region}/homes`;
  switch (category) {
  case 'popular':
      // No additional filter needed for 'popular', just return regular search results
      break;
  case 'cheapest':
    searchUrl += `?price_min=1`;  // Adjust this as necessary
    break;
  case 'mid-price':
    searchUrl += `?price_min=50&price_max=200`;  // Adjust price range as necessary
    break;
  case 'expensive':
    searchUrl += `?price_max=10000`;  // Adjust this as necessary
    break;
  // If the category is 'popular' or other categories, no additional filtering needed
  default:
    break;
}
  // Extract the map bounds and zoom level from the initial Airbnb URL
  const { mapBounds, zoomLevel } = await extractBoundsFromUrl(searchUrl);
  // Scrape the pixel coordinates of the markers
  const markers = await scrapeAirbnbMapMarkers(searchUrl);

  if (!mapBounds || isNaN(zoomLevel)) {
    res.status(500).json({ error: 'Failed to fetch map bounds' });
    return;
  }
   // Construct the final Airbnb URL with map bounds and zoom level
   searchUrl += `&ne_lat=${mapBounds.northeast.lat}&ne_lng=${mapBounds.northeast.lng}&sw_lat=${mapBounds.southwest.lat}&sw_lng=${mapBounds.southwest.lng}&zoom=${zoomLevel}&zoom_level=${zoomLevel}&search_by_map=true`;
   console.log('Navigating to final URL:', searchUrl);
console.log('Map bounds:', mapBounds);
  console.log('Zoom Level:', zoomLevel);
  console.log('Marker positions:', markers);
    

  // Convert each pixel marker to lat/lng
  // Convert all marker pixel positions to lat/lng
  const mapWidth = 1024;
  const mapHeight = 768;
// Convert all marker pixel positions to lat/lng with scaling
const scaleFactor = 3; // Adjust this factor as needed
const markerLatLngs = markers.map(marker => pixelToLatLng(marker.left, marker.top, mapBounds, mapWidth, mapHeight, scaleFactor));

console.log('Converted Marker Lat/Lng with Scaling:', markerLatLngs);


  // Send the lat/lng markers as JSON response
  res.json(markerLatLngs);
});
const PORT = process.env.PORT || 3000;
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
// Wrap Express app as Firebase Cloud Function
//exports.api = functions.https.onRequest(app);
