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
const sitesDir = path.join(__dirname, (isLocal ? '../' : '') + 's');

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

function saveMenuPage(login, menu) {
    let htmlContent = fs.readFileSync('./templates/index.html', 'utf8');
    let cssContent = fs.readFileSync('./templates/style.css', 'utf8');
    htmlContent = htmlContent
        .replace('${styles}', cssContent)
        .replace('${login}', login)
        .replace('${menu}', menu);
    fs.writeFileSync(`${sitesDir}/${login}/index.html`, htmlContent);
}

function createDishCard(dish) {
    return `
    <div class="dish-card">
      <img src="${dish.imgUrl /*|| '../dish_placeholder.png'*/}" alt="${dish.name}">
      <div class="content">
        <h3>${dish.name}</h3>
        <p>${dish.description}</p>
        <p>${dish.price} TL</p>
      </div>
    </div>
  `;
}

/**
 * @typedef {Object} Dish
 * @property {string} name
 * @property {string} price
 * @property {string} imgUrl
 *
 * @param {Dish[]} data
 */
function generateMenuTable(data) {
    return data.map(createDishCard).join('');
}

function prolongToken(decoded) {
    return jwt.sign({...decoded, exp: Math.floor(Date.now() / 1000) + (60 * 60)}, settings.KEY);
}

function generateQRCode(login) {
    QRCode.toFile(`${sitesDir}/${login}/qr.png`, settings.DOMAIN + `/s/` + login, {
        color: {
            dark: '#000',
            light: '#FFF'
        }
    }, (err) => {
        if (err) throw err;
    });
}

app.post('/', (req, res) => {
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
        fs.mkdirSync(`${sitesDir}/${login}`);
        fs.mkdirSync(`${sitesDir}/${login}/imgs`);
        const exampleData = new Array(10).fill(0).map((_, i) => ({
            name: 'Dish' + i,
            description: 'Description' + i,
            price: '10' + i,
            imgUrl: '../dish_placeholder.png?q=' + i
        }));
        fs.writeFileSync(`${sitesDir}/${login}/data.json`, JSON.stringify(exampleData));
        saveMenuPage(login, '<p>There are no dishes yet</p>');
        generateQRCode(login);

        return res.status(200).json({token});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

app.get('/', (req, res) => {
    let decoded;
    try {
        decoded = jwt.verify(req.query.token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        const data = fs.readFileSync(`${sitesDir}/${decoded.login}/data.json`, 'utf8');
        return res.status(200).json({token: prolongToken(decoded), login: decoded.login, data: JSON.parse(data)});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

app.put('/', (req, res) => {
    let decoded;
    try {
        const {token} = req.query;
        decoded = jwt.verify(token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        const data = req.body;

        fs.writeFileSync(`${sitesDir}/${decoded.login}/data.json`, JSON.stringify(data));

        saveMenuPage(decoded.login, generateMenuTable(data));

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

app.post('/upload/:login/:index', upload.single('image'), function (req, res, next) {
    const imageUrl = `${req.protocol}://${req.get('host')}/${req.params.login}/imgs/${req.file.filename}`;
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
