// TODO: fs sync -> async

const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const QRCode = require('qrcode');
const path = require('path');
const multer = require('multer');

const credentialsPath = './data/credentials.txt';
/**
 * @typedef {Object} Settings
 * @property {string} KEY
 * @property {string} DOMAIN
 */
const isLocal = __dirname.includes('Users/');
const settingsPath = `./settings.${isLocal ? 'local' : 'prod'}.json`;
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const sitesDir = path.join(__dirname, 'sites');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});
// app.use('/:login', (req, res, next) => {
//     const userDir = path.join(sitesDir, req.params.login);
//     express.static(userDir)(req, res, next);
// });

function recCopy(s, s2) {
    const stat = fs.statSync(s);
    if (stat.isDirectory()) {
        if (!fs.existsSync(s2)) {
            fs.mkdirSync(s2);
        }
        fs.readdirSync(s).forEach((file) => {
            recCopy(path.join(s, file), path.join(s2, file));
        });
    } else {
        fs.copyFileSync(s, s2);
        if (!fs.existsSync(s2)) {
            console.error(`Failed to copy file ${s} to ${s2}`);
            throw new Error(`Failed to copy file ${s} to ${s2}`);
        }
    }
}

function createDishCard(dish) {
    return `
    <div class="dish-card">
      <img src="${dish.imgUrl || `${settings.DOMAIN}/imgs/dish_placeholder.png`}" alt="${dish.name}">
      <div class="content">
        <h3>${dish.name}</h3>
        <p>${dish.description}</p>
        <p>${dish.category}</p>
        <p>${dish.price} TL</p>
      </div>
    </div>
  `;
}

function prolongToken(decoded) {
    let payload = {...decoded, exp: Math.floor(Date.now() / 1000) + (60 * 60)};
    return jwt.sign(payload, settings.KEY);
}

async function generateQRCode(id) {
    return new Promise((resolve, reject) => {
        QRCode.toFile(`${sitesDir}/${id}/qr.png`, settings.DOMAIN + `/sites/` + id, {
            color: {
                dark: '#000',
                light: '#FFF'
            }
        }, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

app.post('/register', async (req, res) => {
    try {
        const {email, password, name} = req.body;
        if (!email || !password || !name) {
            return res.status(422).send('Missing required fields');
        }
        if (!/.+@.+\..+/.test(email)) {
            return res.status(422).send('Please enter a valid email address');
        }
        const user = findUser(undefined, email);
        if (user) {
            return res.status(409).send('Email already registered');
        }
        const credentials = fs.readFileSync(credentialsPath, 'utf8').split('\n');
        const id = credentials.length ? credentials.length : 1;
        let payload = {id, email, password, exp: Math.floor(Date.now() / 1000) + (60 * 60)};
        const token = jwt.sign(payload, settings.KEY);
        fs.appendFileSync(credentialsPath, `${id}\t${name}\t${email}\t${password}\n`);
        const credentials2 = fs.readFileSync(credentialsPath, 'utf8').split('\n');
        if (!credentials2.find(line => line.startsWith(id + '\t'))) {
            console.error(`Failed to save credentials for ${id}`);
            return res.status(500).send('Server error');
        }
        fs.mkdirSync(`${sitesDir}/${id}`);
        if (!fs.existsSync(`${sitesDir}/${id}`)) {
            console.error(`Failed to create site directory for ${id}`);
            return res.status(500).send('Server error');
        }
        fs.mkdirSync(`${sitesDir}/${id}/imgs`);
        if (!fs.existsSync(`${sitesDir}/${id}/imgs`)) {
            console.error(`Failed to create site directory for ${id}`);
            return res.status(500).send('Server error');
        }
        await generateQRCode(id);
        if (!fs.existsSync(`${sitesDir}/${id}/qr.png`)) {
            console.error(`Failed to create QR code for ${id}`);
            return res.status(500).send('Server error');
        }
        // const initData = new Array(10).fill(0).map((_, i) => ({name: 'Dish' + i, description: 'Description' + i, price: '10' + i, imgUrl: `${settings.DOMAIN}/imgs/dish_placeholder.png?q=${i}`}));
        let initData;
        if (fs.existsSync('./exampleData.json')) {
            initData = JSON.parse(fs.readFileSync('./exampleData.json', 'utf8')).map(dish => ({
                ...dish,
                imgUrl: dish.imgUrl.replace('${domain}', settings.DOMAIN)
            }));
        } else {
            initData = [];
        }
        saveDataAndPage(id, initData);
        return res.status(200).json({id, name, token});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

app.post('/login', async (req, res) => {
    try {
        const {email, password} = req.body;
        if (!email || !password) {
            return res.status(422).send('Missing required fields');
        }
        if (!/.+@.+\..+/.test(email)) {
            return res.status(422).send('Please enter a valid email address');
        }

        const user = findUser(undefined, email);
        if (!user) {
            return res.status(404).send('Email not registered');
        }
        let payload = {id: user.id, email, password, exp: Math.floor(Date.now() / 1000) + (60 * 60)};
        const token = jwt.sign(payload, settings.KEY);
        if (user.password !== password) {
            return res.status(401).send('Wrong password');
        }
        return res.status(200).json({id: user.id, name: user.name, token});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

function loadData(id) {
    return JSON.parse(fs.readFileSync(`${sitesDir}/${id}/data.json`, 'utf8'));
}

app.get('/', (req, res) => {
    let decoded;
    try {
        decoded = jwt.verify(req.query.token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        const user = findUser(decoded.id);
        if (!user) {
            return res.status(401).send('User not found');
        }
        const data = loadData(decoded.id);
        return res.status(200).json({token: prolongToken(decoded), name: user.name, id: user.id, data});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

function findUser(id = undefined, email = undefined) {
    const credentials = fs.readFileSync(credentialsPath, 'utf8').split('\n');
    let line = credentials.find(line => line.startsWith(id + '\t'));
    if (!line) {
        line = credentials.find(line => line.includes('\t' + email + '\t'));
    }
    if (!line) {
        return undefined;
    }
    return {
        id: line.split('\t')[0],
        name: line.split('\t')[1],
        email: line.split('\t')[2],
        password: line.split('\t')[3].trim()
    };
}

function saveDataAndPage(id, data) {
    const user = findUser(id);
    if (!user) {
        console.error(`User ${id} not found`);
        throw new Error('User not found');
    }
    fs.writeFileSync(`${sitesDir}/${id}/data.json`, JSON.stringify(data));
    let menu = '';
    if (!data.length) {
        menu = '<p>There are no dishes yet</p>';
    }
    // data.sort((a, b) => a.category.localeCompare(b.category));
    const categories = data.reduce((a, c) => a.includes(c.category) ? a : [...a, c.category], []);
    let categoriesHtml = '';
    for (const category of categories) {
        categoriesHtml += `<a href="#${category.toLowerCase()}">${category}</a>`
    }
    for (let i = 0; i < data.length; i++) {
        if (i > 0 && data[i].category !== data[i - 1].category) {
            menu += '<div class="dish-card dish-card-filler"></div><div class="dish-card dish-card-filler"></div><div class="dish-card dish-card-filler"></div>';
            menu += '</div>';
        }
        if (i === 0 || data[i].category !== data[i - 1].category) {
            menu += `<h1 class="category-label" id="${data[i].category.toLowerCase()}">${data[i].category}</h1><div class="category-container">`;
        }
        menu += createDishCard(data[i]);
    }
    menu += '<div class="dish-card dish-card-filler"></div><div class="dish-card dish-card-filler"></div><div class="dish-card dish-card-filler"></div>';
    menu += '</div>';
    let htmlContent = fs.readFileSync('./templates/index.html', 'utf8');
    let cssContent = fs.readFileSync('./templates/style.css', 'utf8');
    htmlContent = htmlContent
        .replace('${domain}', settings.DOMAIN)
        .replace('${styles}', cssContent)
        .replace('${name}', user.name)
        .replace('${categories}', categoriesHtml)
        .replace('${menu}', menu);
    fs.writeFileSync(`${sitesDir}/${id}/index.html`, htmlContent);
    if (!fs.existsSync(`${sitesDir}/${id}/index.html`)) {
        console.error(`Failed to create page for ${id}`);
        throw new Error('Failed to create page');
    }
    if (isLocal) {
        recCopy(`sites/${id}`, `../client/sites/${id}`);
    }
}

app.put('/', (req, res) => {
    let decoded;
    try {
        const {token} = req.query;
        decoded = jwt.verify(token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        saveDataAndPage(decoded.id, req.body);
        return res.status(200).json({token: prolongToken(decoded)});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(sitesDir, req.params.id, 'imgs');
        fs.mkdirSync(uploadPath, {recursive: true});
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({storage: storage});

app.post('/upload/:id/:index', upload.single('image'), function (req, res) {
    const imageUrl = `${settings.DOMAIN}/sites/${req.params.id}/imgs/${req.file.filename}`;
    const data = loadData(req.params.id);
    data[req.params.index].imgUrl = imageUrl;
    saveDataAndPage(req.params.id, data);
    res.json({imgUrl: imageUrl});
});

const port = 3001;

function init() {
    if (!fs.existsSync(credentialsPath)) {
        fs.writeFileSync(credentialsPath, '');
    }
    if (!fs.existsSync(settingsPath)) {
        console.error(`Settings file ${settingsPath} not found`);
        process.exit(1);
    }
}

app.listen(port, () => {
    init();
    console.log(`Server listening on port ${port}`);
});
