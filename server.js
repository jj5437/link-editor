import express from 'express';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const { MONGO_URI, ADMIN_USER, ADMIN_PASSWORD, API_BASE_URL } = process.env;
const PORT = process.env.PORT || 3000;
const AUTH_COOKIE_NAME = 'auth_token';
const API_PREFIX = API_BASE_URL || '/api';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


let db;

// --- Database Connection ---
async function connectToDb() {
    try {
        const client = new MongoClient(MONGO_URI,{
            serverSelectionTimeoutMS: 5000,
            heartbeatFrequencyMS: 1000,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 360000,
            retryWrites: true,
            retryReads: true,
        });
        await client.connect();
        db = client.db('chat_ldata'); // Use the specific db from the URI
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
        process.exit(1);
    }
}

// --- Authentication Middleware ---
const authMiddleware = (req, res, next) => {
    const authToken = req.cookies[AUTH_COOKIE_NAME];
    if (authToken === 'logged_in') { // Simple check, could be more secure (e.g., JWT)
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
};

// --- API Routes ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
        res.cookie(AUTH_COOKIE_NAME, 'logged_in', { httpOnly: true, maxAge: 3600 * 1000 }); // 1 hour cookie
        res.status(200).json({ message: 'Login successful' });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME);
    res.status(200).json({ message: 'Logged out' });
});

// GET all users (except admin) and their linkMappings
app.get(`${API_PREFIX}/users`, authMiddleware, async (req, res) => {
    try {
        const users = await db.collection('users').find({
            username: { $ne: 'admin' }
        }).project({
            username: 1,
            'preferences.linkMappings': 1
        }).toArray();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching data from database.' });
    }
});

// Update a user's linkMappings
app.post(`${API_PREFIX}/users/:username`, authMiddleware, async (req, res) => {
    const { username } = req.params;
    const { linkMappings } = req.body;

    if (!Array.isArray(linkMappings)) {
        return res.status(400).json({ message: 'linkMappings must be an array.' });
    }

    try {
        const result = await db.collection('users').updateOne(
            { username: username },
            { $set: { 'preferences.linkMappings': linkMappings } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User updated successfully.' });
    } catch (error) {
        console.error(`Error updating user ${username}:`, error);
        res.status(500).json({ message: 'Error updating data in database.' });
    }
});


// --- Serve Frontend ---
// For any other GET request, send the dashboard (if logged in) or login page
app.get('*', (req, res) => {
    if (req.cookies[AUTH_COOKIE_NAME] === 'logged_in') {
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});


// --- Start Server ---
connectToDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}); 