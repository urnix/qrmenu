// TODO: fs sync -> async

const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const QRCode = require('qrcode');
const path = require('path');
const multer = require('multer');

const credentialsPath = './credentials.txt';
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
app.use('/:login', (req, res, next) => {
    const userDir = path.join(sitesDir, req.params.login);
    express.static(userDir)(req, res, next);
});

const isValidData = (data) => /^[a-zA-Z0-9-_]+$/.test(data);

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
    return jwt.sign({...decoded, exp: Math.floor(Date.now() / 1000) + (60 * 60)}, settings.KEY);
}

async function generateQRCode(login) {
    return new Promise((resolve, reject) => {
        QRCode.toFile(`${sitesDir}/${login}/qr.png`, settings.DOMAIN + `/sites/` + login, {
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

app.post('/', async (req, res) => {
    try {
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

        fs.appendFileSync(credentialsPath, `${login}\t${password}\n`);
        const credentials2 = fs.readFileSync(credentialsPath, 'utf8').split('\n');
        if (!credentials2.find(line => line.startsWith(login + '\t'))) {
            console.error(`Failed to save credentials for ${login}`);
            return res.status(500).send('Server error');
        }
        fs.mkdirSync(`${sitesDir}/${login}`);
        if (!fs.existsSync(`${sitesDir}/${login}`)) {
            console.error(`Failed to create site directory for ${login}`);
            return res.status(500).send('Server error');
        }
        fs.mkdirSync(`${sitesDir}/${login}/imgs`);
        if (!fs.existsSync(`${sitesDir}/${login}/imgs`)) {
            console.error(`Failed to create site directory for ${login}`);
            return res.status(500).send('Server error');
        }
        await generateQRCode(login);
        if (!fs.existsSync(`${sitesDir}/${login}/qr.png`)) {
            console.error(`Failed to create QR code for ${login}`);
            return res.status(500).send('Server error');
        }
        // const initData = new Array(10).fill(0).map((_, i) => ({name: 'Dish' + i, description: 'Description' + i, price: '10' + i, imgUrl: `${settings.DOMAIN}/imgs/dish_placeholder.png?q=${i}`}));
        let initData;
        if (fs.existsSync('./exampleData.json')) {
            initData = JSON.parse(fs.readFileSync('./exampleData.json', 'utf8')).map((dish, i) => ({
                ...dish,
                imgUrl: dish.imgUrl.replace('${domain}', settings.DOMAIN)
            }));
        } else {
            initData = [];
        }
        saveDataAndPage(login, initData);
        return res.status(200).json({token});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

function loadData(login) {
    return JSON.parse(fs.readFileSync(`${sitesDir}/${login}/data.json`, 'utf8'));
}

app.get('/', (req, res) => {
    let decoded;
    try {
        decoded = jwt.verify(req.query.token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        const data = loadData(decoded.login);
        return res.status(200).json({token: prolongToken(decoded), login: decoded.login, data});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

function saveDataAndPage(login, data) {
    fs.writeFileSync(`${sitesDir}/${login}/data.json`, JSON.stringify(data));
    let menu = '';
    if (!data.length) {
        menu = '<p>There are no dishes yet</p>';
    }
    data.sort((a, b) => a.category.localeCompare(b.category));
    const categories = data.reduce((a, c) => a.includes(c.category) ? a : [...a, c.category], []);
    let categoriesHtml = '';
    for (const category of categories) {
        categoriesHtml += `<a href="#${category.toLowerCase()}">${category}</a>`
    }
    for (let i = 0; i < data.length; i++) {
        if (i === 0 || data[i].category !== data[i - 1].category) {
            menu += `<h1 class="category-label" id="${data[i].category.toLowerCase()}">${data[i].category}</h1>`;
        }
        menu += createDishCard(data[i]);
    }
    let htmlContent = fs.readFileSync('./templates/index.html', 'utf8');
    let cssContent = fs.readFileSync('./templates/style.css', 'utf8');
    htmlContent = htmlContent
        .replace('${domain}', settings.DOMAIN)
        .replace('${styles}', cssContent)
        .replace('${login}', login)
        .replace('${categories}', categoriesHtml)
        .replace('${menu}', menu);
    fs.writeFileSync(`${sitesDir}/${login}/index.html`, htmlContent);
    if (!fs.existsSync(`${sitesDir}/${login}/index.html`)) {
        console.error(`Failed to create page for ${login}`);
        throw new Error('Failed to create page');
    }
    if (isLocal) {
        recCopy(`sites/${login}`, `../client/sites/${login}`);
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
        saveDataAndPage(decoded.login, req.body);
        return res.status(200).json({token: prolongToken(decoded)});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(sitesDir, req.params.login, 'imgs');
        fs.mkdirSync(uploadPath, {recursive: true});
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({storage: storage});

app.post('/upload/:login/:index', upload.single('image'), function (req, res) {
    const imageUrl = `${settings.DOMAIN}/sites/${req.params.login}/imgs/${req.file.filename}`;
    const data = loadData(req.params.login);
    data[req.params.index].imgUrl = imageUrl;
    saveDataAndPage(req.params.login, data);
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
