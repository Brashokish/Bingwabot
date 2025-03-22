const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const nodemailer = require('nodemailer'); // Import nodemailer
const axios = require('axios'); // Ensure axios is imported for making HTTP requests
const express = require('express'); // Ensure express is imported

const userState = {}; // Store user states

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        defaultViewport: null,
        headless: true,
        timeout: 60000, 
    },
    qr: {
        refreshInterval: 120000 // QR code refreshes every 120 seconds (2 minutes)
    }
});

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use your email provider (Gmail, etc.)
    auth: {
        user: 'emmkash20@gmail.com',  // Replace with your email
        pass: 'mjwq oiug wfxv vexl',   // Replace with your email password or app-specific password
    },
});

// QR Code Generation and Email Sending
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code received, scan with your WhatsApp!');

    // Send the QR code to the specified email address
    sendQRCodeViaEmail(qr);
});

// Send QR Code via Email
function sendQRCodeViaEmail(qrCode) {
    const mailOptions = {
        from: 'emmkash20@gmail.com',  // Your email address
        to: 'brashokish499@gmail.com',  // Replace with the recipient's email
        subject: 'WhatsApp Web QR Code for Authentication',
        text: 'Please scan the QR code below to authenticate the bot:',
        html: `<p>Please scan the QR code below to authenticate the bot:</p><pre>${qrCode}</pre>`,  // Send QR code in email body
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error sending email: ', error);
        } else {
            console.log('QR Code sent to email: ' + info.response);
        }
    });
}

// Client Ready
client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

// Handle Disconnection and Reconnection
client.on('disconnected', async (reason) => {
    console.log('Disconnected from WhatsApp. Reconnecting...', reason);
    await client.destroy(); // Clean up existing connection
    initializeClient(); // Reinitialize the client
});

// Initialize the Client
async function initializeClient() {
    try {
        await client.initialize();
    } catch (error) {
        console.error('Error initializing client. Retrying...', error);
        setTimeout(initializeClient, 5000); // Retry after 5 seconds
    }
}

initializeClient(); // Start the initialization process

client.on('message', async (message) => {
    try {
        const content = message.body.toLowerCase().trim();
        const sender = message.from;

        // Initialize user state if not set
        if (!userState[sender]) {
            userState[sender] = {
                categorySelected: null,
                dealSelected: false,
                selectedDeal: null,
            };
        }

        console.log('Message received:', content);

        // Updated phone number regex to allow all Kenyan formats
        const phoneRegex = /^(?:\+254|254|0)\d{9}$/;

        // Main menu "buy" command
        if (content.includes('buy')) {
            userState[sender] = {
                categorySelected: null,
                dealSelected: false,
                selectedDeal: null,
            };

            message.reply(
                `🎉KUNUNUA NI MARA MOJA KWA SIKU ,🎉 Welcome to Bingwa Sokoni Bot By Emmkash-Tech! Please choose a category by typing:
                - *1* for Data Deals
                - *2* for SMS Deals
                - *3* for Minutes Deals

                Just type the number to choose a category (e.g., *1* for Data).`
            );
        } 
        // Handle category selection
        else if (!userState[sender].categorySelected) {
            if (content === '1') {
                userState[sender].categorySelected = 'data';
                sendDealsMenu(message, 'data');
            } else if (content === '2') {
                userState[sender].categorySelected = 'sms';
                sendDealsMenu(message, 'sms');
            } else if (content === '3') {
                userState[sender].categorySelected = 'minutes';
                sendDealsMenu(message, 'minutes');
            } else {
                message.reply("Invalid selection. Type *buy* to start again.");
            }
        } 
        // Handle deal selection
        else if (!userState[sender].dealSelected) {
            const selectedCategory = userState[sender].categorySelected;
            const deal = mapDeal(selectedCategory, content);
            if (deal) {
                userState[sender].dealSelected = true;
                userState[sender].selectedDeal = deal;
                message.reply(
                    `You selected: "${deal.description}"\n\nType *yes* to confirm or *no* to cancel.`
                );
            } else {
                message.reply('Invalid option. Please select a valid deal.');
            }
        } 
        // Handle confirmation
        else if (content === 'yes') {
            message.reply('Please enter your phone number to proceed with the payment🥳✅');
        } 
        // Handle phone number input
        else if (phoneRegex.test(content)) {
            const phoneNumber = formatPhoneNumber(content.trim());
            const { amount, description } = userState[sender].selectedDeal;

            try {
                const stkPushResponse = await initiateStkPush(amount, phoneNumber);
                message.reply(`STK Push initiated for "${description}". Please enter your M-Pesa PIN to complete.`);
            } catch (error) {
                console.error(error);
                message.reply('Error initiating payment. Please try again.');
            }
        } else {
            message.reply("I couldn't understand that. Please select a valid option or type *buy* to start over.");
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Function to send deal menus
function sendDealsMenu(message, category) {
    const menus = {
        data: `You have selected *Data Deals*. Here are the options:
        1. 1GB @ Ksh 19 (1 hour)
        2. 1.5GB @ Ksh 50 (3 hours)
        3. 1.25GB @ Ksh 55 (midnight)
        4. 250MB @ Ksh 20 (24 hours)
        5. 1GB @ Ksh 99 (24 hours)
        6. 350MB @ Ksh 49 (7 days)
        7. 2.5GB @ Ksh 300 (7 days)
        8. 6GB @ Ksh 700 (7 days)`,
        sms: `You have selected *SMS Deals*. Here are the options:
        1. 200 SMS @ Ksh 10 (24 hours)
        2. 20 SMS @ Ksh 5 (24 hours)
        3. 1000 SMS @ Ksh 30 (7 days)`,
        minutes: `You have selected *Minutes Deals*. Here are the options:
        1. 34MIN @ Ksh 18 (midnight)
        2. 50MIN @ Ksh 51
        3. 50 CREDO @ Ksh 21
        4. 100MIN @ Ksh 102 (2 days)
        5. 200MIN @ Ksh 250`,
    };

    message.reply(menus[category] || 'Invalid category selected.');
}

// Map deals based on category and input
function mapDeal(category, option) {
    const deals = {
        data: [
            { id: '1', description: '1GB @ Ksh 19 (1 hour)', amount: 19 },
            { id: '2', description: '1.5GB @ Ksh 50 (3 hours)', amount: 50 },
            { id: '3', description: '1.25GB @ Ksh 55 (midnight)', amount: 55 },
            { id: '4', description: '250MB @ Ksh 20 (24 hours)', amount: 20 },
            { id: '5', description: '1GB @ Ksh 99 (24 hours)', amount: 99 },
            { id: '6', description: '350MB @ Ksh 49 (7 days)', amount: 49 },
            { id: '7', description: '2.5GB @ Ksh 300 (7 days)', amount: 300 },
            { id: '8', description: '6GB @ Ksh 700 (7 days)', amount: 700 },
        ],
        sms: [
            { id: '1', description: '200 SMS @ Ksh 10 (24 hours)', amount: 10 },
            { id: '2', description: '20 SMS @ Ksh 5 (24 hours)', amount: 5 },
            { id: '3', description: '1000 SMS @ Ksh 30 (7 days)', amount: 30 },
        ],
        minutes: [
            { id: '1', description: '34MIN @ Ksh 18 (midnight)', amount: 18 },
            { id: '2', description: '50MIN @ Ksh 51', amount: 51 },
            { id: '3', description: '50 CREDO @ Ksh 21', amount: 21 },
            { id: '4', description: '100MIN @ Ksh 102 (2 days)', amount: 102 },
            { id: '5', description: '200MIN @ Ksh 250', amount: 250 },
        ],
    };

    return deals[category]?.find((deal) => deal.id === option);
}

// Format phone number
function formatPhoneNumber(number) {
    if (number.startsWith('254')) return `+${number}`;
    if (number.startsWith('0')) return `+254${number.slice(1)}`;
    return number;
}

// Function to initiate STK Push via PayHero API
async function initiateStkPush(amount, phoneNumber) {
    const API_USERNAME = '5iOsVi1JBm2fDQJl5LPD';
    const API_PASSWORD = 'vNxb1zHkPV2tYro4SgRDXhTtWBEr8R46EQiBUvkD';
    const stk_push_url = 'https://backend.payhero.co.ke/api/v2/payments';

    const payload = {
        amount: amount,
        phone_number: phoneNumber,
        channel_id: 852,
        provider: 'm-pesa',
        external_reference: 'INV-009', // Use a unique reference for each transaction
        callback_url: 'https://softcash.co.ke/billing/callbackurl.php'
    };

    try {
        const response = await axios.post(stk_push_url, payload, {
            auth: {
                username: API_USERNAME,
                password: API_PASSWORD
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        throw new Error('Failed to initiate STK Push');
    }
}

// Express server setup
const app = express();

app.get('/', (req, res) => {
    res.send('WhatsApp Bot is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
