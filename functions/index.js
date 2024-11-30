const functions = require('firebase-functions'); // Use CommonJS for Firebase Functions
const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');
const axios = require('axios');
// Set Puppeteer's cache directory
//process.env.PUPPETEER_CACHE_DIR = '/tmp'; // Use Firebase's writable tmp directory
//const chromePath = './functions/tmp/chrome/mac_arm-131.0.6778.85/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

// Debugging
//console.log('Using Puppeteer Cache Directory:', process.env.PUPPETEER_CACHE_DIR);
//console.log('Using Chrome Executable Path:', chromePath);
//console.log("Chrome path:", chromePath);



const cors = require('cors');

const app = express();
const path = require('path');

//const cors = require('cors')({ origin: true });
// Middleware
//app.use(cors());
app.use(express.json());


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
const corsConfig = cors({
  origin: [
    'http://localhost:5001', // Emulator
    'https://shange-fagan.github.io', // GitHub Pages
    'https://horizonflights.org', // Custom domain
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow credentials like cookies, tokens, etc.
});
app.use(corsConfig);
app.options('*', (req, res) => {
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  });
app.options('*', corsConfig);
function waitForTimeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function launchBrowser() {
  const executablePath = await chromium.executablePath;

  if (!executablePath) {
    throw new Error('Chromium executable path not found.');
  }

  return await puppeteer.launch({
    headless: true,
    args: [
      ...chromium.args, // Include default Chromium args
      '--window-size=1920,1080', // Set window size
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', // Set user-agent
      '--no-sandbox', // Prevent sandboxing (required for some environments)
      '--disable-setuid-sandbox', // Disable setuid sandbox
      '--disable-dev-shm-usage', // Prevent issues with /dev/shm
    ],
    executablePath: executablePath, // Use the Chromium binary from chrome-aws-lambda
    defaultViewport: chromium.defaultViewport,
  });
}
let browser;

const searchUrl = 'https://www.booking.com/searchresults.en-gb.html?ss=${location}&efdco=1&label=gen173nr-1BCAEoggI46AdIM1gEaFCIAQGYAQm4AQfIAQ3YAQHoAQGIAgGoAgO4Ar2Go7oGwAIB0gIkMWUyNDY4NTgtMzk0Yy00NTI1LTgzMTUtM2YwYzFkYmIwYTJm2AIF4AIB&sid=cbab34cb05d1292aadca8e577bbd857d&aid=304142&lang=${language}&sb=1&src_elem=sb&src=index&dest_id=-2601889&dest_type=${location_type}&checkin=${checkin}&checkout=${checkout}&group_adults=${guests}&no_rooms=${room_no}&group_children=${no_of_children}';

async function scrapeBooking(searchUrl) {
   browser = await launchBrowser();
    const page = await browser.newPage();

    try {
        console.log(`Navigating to ${searchUrl}...`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for the search results to load
        await page.waitForSelector('.sr_property_block_main_row', { timeout: 10000 });

        // Scrape the search results
        const results = await page.evaluate(() => {
            const listings = [];
            const items = document.querySelectorAll('.sr_property_block_main_row');

            items.forEach(item => {
                const title = item.querySelector('.sr-hotel__name')?.textContent.trim();
                const link = item.querySelector('.hotel_name_link')?.href;
                const price = item.querySelector('.bui-price-display__value')?.textContent.trim();
                const rating = item.querySelector('.bui-review-score__badge')?.textContent.trim();

                listings.push({ title, link, price, rating });
            });

            return listings;
        });

        console.log('Scraped Results:', results);

        return results;

    } catch (error) {
        console.error('Error scraping Booking.com:', error);
        return [];
    } finally {
        await browser.close();
    }
}

// Example Usage
(async () => {
    const searchUrl = 'https://www.booking.com/searchresults.en-gb.html?ss=${location}&efdco=1&label=gen173nr-1BCAEoggI46AdIM1gEaFCIAQGYAQm4AQfIAQ3YAQHoAQGIAgGoAgO4Ar2Go7oGwAIB0gIkMWUyNDY4NTgtMzk0Yy00NTI1LTgzMTUtM2YwYzFkYmIwYTJm2AIF4AIB&sid=cbab34cb05d1292aadca8e577bbd857d&aid=304142&lang=${language}&sb=1&src_elem=sb&src=index&dest_id=-2601889&dest_type=${location_type}&checkin=${checkin}&checkout=${checkout}&group_adults=${guests}&no_rooms=${room_no}&group_children=${no_of_children}'; // Replace with the desired URL
    const listings = await scrapeBooking(searchUrl);

    // Output the results
    console.log('Listings:', listings);

    // Process the results (populate the overlay or save to the database)
    // populateOverlay(listings); // Call your populateOverlay function with the data
})();

app.get('/scrape-booking.com', async (req, res) => {
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
const language = parsedUrl.searchParams.get('language');
const location_type = parsedUrl.searchParams.get('location_type');
const checkin = parsedUrl.searchParams.get('checkin');
const checkout = parsedUrl.searchParams.get('checkout');
const guests = parsedUrl.searchParams.get('adults');
const room_no = parsedUrl.searchParams.get('room_no');
const no_of_children = parsedUrl.searchParams.get('no_of_children');
//const monthly_start = parsedUrl.searchParams.get('monthlyStart');
//const monthly_end = parsedUrl.searchParams.get('monthlyEnd');

console.log(`Location: ${location}, Language: ${language}, Location type: ${location_type}, Checkin: ${checkin}, Checkout: ${checkout}, Guests: ${guests}, no. of rooms: ${room_no}, no. of children: ${children}`);

// Use these parameters to build your final search URL
let finalSearchUrl = `https://www.booking.com/searchresults.en-gb.html?ss=${location}&efdco=1&label=gen173nr-1BCAEoggI46AdIM1gEaFCIAQGYAQm4AQfIAQ3YAQHoAQGIAgGoAgO4Ar2Go7oGwAIB0gIkMWUyNDY4NTgtMzk0Yy00NTI1LTgzMTUtM2YwYzFkYmIwYTJm2AIF4AIB&sid=cbab34cb05d1292aadca8e577bbd857d&aid=304142&lang=${language}&sb=1&src_elem=sb&src=index&dest_id=-2601889&dest_type=${location_type}&checkin=${checkin}&checkout=${checkout}&group_adults=${guests}&no_rooms=${room_no}&group_children=${no_of_children}#map_opened`;

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


  