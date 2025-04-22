const express = require('express');
const cors = require("cors");
const stripe = require("stripe")("sk_"); // Replace with your actual Stripe secret key
const bodyParser = require("body-parser");

const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

// Initialize LowDB
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { users: [] }); // ← this sets the default

async function initDB() {
    await db.read();
    if (!db.data) {
        db.data = { users: [] };
        await db.write();
    }
}

const app = express();
const PORT = process.env.PORT || 8080;

// CORS setup
const allowedOrigins = [
    "https://horizonflights.travel",
    "http://localhost:3005",
    "https://shange-fagan.github.io"
];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning");
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
        return res.status(204).send();
    }
    next();
});
// ✅ Handle OPTIONS Requests (Preflight Requests)
app.options("*", (req, res) => {
    res.set({
        "Access-Control-Allow-Origin": req.headers.origin || "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
        "Access-Control-Allow-Credentials": "true"
    });
    return res.status(204).send(); // 204 No Content
});
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));
// Only use raw for webhook (because Stripe needs the raw body for signature verification)
app.use('/webhook', bodyParser.raw({ type: 'application/json' }));
// Use express.json() everywhere else
app.use(express.json());
app.get('/', (req, res) => {
    res.send('Stripe Checkout API is up and running ✅');
  });
  
// Save premium status by email
async function setUserPremiumByEmail(email) {
    await initDB();
    const user = db.data.users.find(u => u.email === email);
    if (user) {
        user.isPremium = true;
    } else {
        db.data.users.push({ email, isPremium: true });
    }
    await db.write();
}

// Check premium status
app.get('/user-status', async (req, res) => {
    await initDB();
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "Email required" });

    const user = db.data.users.find(u => u.email === email);
    res.json({ isPremium: user?.isPremium === true });
});

// Create checkout session
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { theme, email } = req.body;

        console.log("📥 Received:", { theme, email });

        if (!theme || !email) {
            return res.status(400).json({ error: "Missing theme or email" });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: theme || "Premium Theme", // fallback
                        description: `✨ Unlock the Exclusive ${theme || "Theme"}! ✨`,
                    },
                    unit_amount: 499
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `https://horizonflights.travel/thank-you`,
            cancel_url: `https://horizonflights.travel/cancel`,
            customer_email: email
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("🔥 Stripe session error:", err);
        res.status(500).json({ error: "Failed to create checkout session." });
    }
});


// Webhook for Stripe events
app.post('/webhook', async (req, res) => {
    const endpointSecret = "whsec_DFamgn5WN6bliWaredKllsln2M28Kfpq"; // Replace with your Stripe webhook secret
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error("⚠️ Webhook signature verification failed.", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_email;
        if (email) {
            await setUserPremiumByEmail(email);
        }
    }

    res.json({ received: true });
});

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error("❌ Failed to initialize DB:", err);
});


