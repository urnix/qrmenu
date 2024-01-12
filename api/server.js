const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});
app.use('/:login', (req, res, next) => {
    const userDir = path.join(usersBaseDir, req.params.login);
    express.static(userDir)(req, res, next);
});

const credentialsPath = './credentials.txt';
/**
 * @typedef {Object} Settings
 * @property {string} KEY
 * @property {string} DOMAIN
 */
const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
const usersBaseDir = path.join(__dirname, 's');

const isValidData = (data) => /^[a-zA-Z0-9-_]+$/.test(data);

function saveMenuPage(login, menu) {
    fs.writeFileSync(`${usersBaseDir}/${login}/index.html`, `<html lang="ru"><body><h2>Menu of ${login}:</h2>${menu}</body></html>`);
}

function prolongToken(decoded) {
    return jwt.sign({...decoded, exp: Math.floor(Date.now() / 1000) + (60 * 60)}, settings.KEY);
}

function generateQRCode(login) {
    QRCode.toFile(`${usersBaseDir}/${login}/qr.png`, settings.DOMAIN + `/s/` + login, {
        color: {
            dark: '#000',
            light: '#FFF'
        }
    }, (err) => {
        if (err) throw err;
    });
}

app.post('/', (req, res) => {
    const {login, password} = req.body;
    if (!isValidData(login) || !isValidData(password)) {
        return res.status(422).send('Please use only letters, numbers, - and _');
    }
    const token = jwt.sign({login, password, exp: Math.floor(Date.now() / 1000) + (60 * 60)}, settings.KEY);

    const credentials = fs.readFileSync(credentialsPath, 'utf8').split('\n');
    const user = credentials.find(line => line.startsWith(login + '\t'));
    if (user) {
        const userPassword = user.split('\t')[1];
        if (userPassword !== password) {
            return res.status(401).send('Wrong password');
        }
        return res.status(200).json({token});
    }

    fs.mkdirSync(`${usersBaseDir}/${login}`);
    fs.mkdirSync(`${usersBaseDir}/${login}/imgs`);
    fs.writeFileSync(`${usersBaseDir}/${login}/data.json`, '[]');
    saveMenuPage(login, '<p>There are no dishes yet</p>');
    generateQRCode(login);

    return res.status(200).json({token});
});

app.get('/', (req, res) => {
    try {
        const {token} = req.query;
        const decoded = jwt.verify(token, settings.KEY);
        const data = fs.readFileSync(`${usersBaseDir}/${decoded.login}/data.json`, 'utf8');
        return res.status(200).json({token: prolongToken(decoded), login: decoded.login, data: JSON.parse(data)});
    } catch (error) {
        return res.status(401).send('Session expired');
    }
});

/**
 * @typedef {Object} Dish
 * @property {string} name
 * @property {string} price
 *
 * @param {Dish[]} data
 */
function generateMenuTable(data) {
    return data.map(d => `<tr><td>${(d.name || '?')}</td><td>${(d.price || '?')}</td></tr>`).join('');
}

app.put('/', (req, res) => {
    try {
        const {token} = req.query;
        const decoded = jwt.verify(token, settings.KEY);
        const data = req.body;

        fs.writeFileSync(`${usersBaseDir}/${decoded.login}/data.json`, JSON.stringify(data));

        saveMenuPage(decoded.login, `<table>${generateMenuTable(data)}</table>`);

        return res.status(200).json({token: prolongToken(decoded)});
    } catch (error) {
        return res.status(401).send('Session expired');
    }
});

const port = 3001;

function init() {
    if (!fs.existsSync(credentialsPath)) {
        fs.writeFileSync(credentialsPath, '');
    }
    if (!fs.existsSync('./settings.json')) {
        console.error('`settings.json` not found');
        process.exit(1);

    }
}

app.listen(port, () => {
    init();
    console.log(`Server listening on port ${port}`);
});
