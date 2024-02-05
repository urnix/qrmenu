// TODO: fs sync -> async
// TODO add timestamps and history of actions
// Add categories
// Repair sorting
// Make description an textarea
// ---
// Improve layout of admin panel
// ---
// Add wifi/pass
// Ability to change name
// Send pass to email

import express from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import QRCode from "qrcode";
import path, {dirname} from "path";
import multer from "multer";
import {fileURLToPath} from 'url';
import gm from "gm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const credentialsPath = './data/credentials.txt';
/**
 * @typedef {Object} Settings
 * @property {string} KEY
 * @property {string} DOMAIN
 */
const isLocal = __dirname.includes('Users/');
const settingsPath = `./settings.${isLocal ? 'local' : 'prod'}.json`;
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const clientSitesPrefix = 'sites';
const sitesDirLocal = 'data/sites';
const sitesDir = path.join(__dirname, sitesDirLocal);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

function getExp() {
    return Math.floor(Date.now() / 1000) + (7 * 60 * 60);
}

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
        <h3>${dish.name.length > 80 ? dish.name.substring(0, 80) + '...' : dish.name}</h3>
        <p>${dish.description.length > 100 ? dish.description.substring(0, 100) + '...' : dish.description}</p>
        <p>${dish.price} TL</p>
      </div>
    </div>
  `;
}

function prolongToken(decoded) {
    let payload = {...decoded, exp: getExp()};
    return jwt.sign(payload, settings.KEY);
}

async function generateQRCode(id) {
    return new Promise((resolve, reject) => {
        QRCode.toFile(`${sitesDir}/${id}/qr.png`, `${settings.DOMAIN}/${clientSitesPrefix}/${id}`, {
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
        let payload = {id, email, password, exp: getExp()};
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
        // if (fs.existsSync('./exampleData.json')) {
        //     initData = JSON.parse(fs.readFileSync('./exampleData.json', 'utf8')).map(dish => ({
        //         ...dish,
        //         imgUrl: dish.imgUrl.replace('${domain}', settings.DOMAIN)
        //     }));
        // } else {
        initData = {
            categories: [
                'No category',
                'Food',
                'Drinks',
            ],
            dishes: []
        };
        // }
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
        let payload = {id: user.id, email, password, exp: getExp()};
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
        // sort by category order first, then by dish order
        data.dishes.sort((a, b) =>
            a.category === b.category
                ? a.order - b.order
                : data.categories.indexOf(a.category) - data.categories.indexOf(b.category));
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
    let categories = data.categories;
    let dishes = data.dishes;
    let menu = '';
    if (!dishes.length) {
        menu = '<div style=\'text-align: center;\'><h3>There are no dishes yet</h3></div>';
    }
    let categoriesHtml = '';
    for (const category of categories) {
        categoriesHtml += `<a href="#${category.toLowerCase().replace(' ', '_')}">${category}</a>`
    }
    dishes = categories.reduce((a, c) => [...a, ...(dishes.filter(dish => dish.category === c))], [])
    for (let i = 0; i < dishes.length; i++) {
        if (i > 0 && dishes[i].category !== dishes[i - 1].category) {
            menu += '<div class="dish-card dish-card-filler"></div><div class="dish-card dish-card-filler"></div><div class="dish-card dish-card-filler"></div>';
            menu += '</div>';
        }
        if (i === 0 || dishes[i].category !== dishes[i - 1].category) {
            menu += `<h1 class="category-label" id="${dishes[i].category.toLowerCase()}">${dishes[i].category}</h1><div class="category-container">`;
        }
        menu += createDishCard(dishes[i]);
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
        recCopy(`${sitesDirLocal}/${id}`, `../client/sites/${id}`);
    }
}

// todo rename in all dishes
app.put('/categories/', (req, res) => {
    let decoded;
    try {
        const {token} = req.query;
        decoded = jwt.verify(token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        let data = loadData(decoded.id);
        let categories = JSON.parse(req.body.value);
        data = {...data, categories};
        saveDataAndPage(decoded.id, data);
        return res.status(200).json({token: prolongToken(decoded)});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

app.put('/categories/:index', (req, res) => {
    let decoded;
    try {
        const {token} = req.query;
        decoded = jwt.verify(token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        const index = parseInt(req.params.index);
        console.log(`index: ${JSON.stringify(index)}`);
        let data = loadData(decoded.id);
        let categories = data.categories;
        if (index < 0 || index >= categories.length) {
            return res.status(404).send('Category not found');
        }
        categories = [...categories.slice(0, index), req.body.value, ...categories.slice(index + 1)];
        data = {...data, categories};
        saveDataAndPage(decoded.id, data);
        return res.status(200).json({token: prolongToken(decoded)});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

app.post('/dishes/', (req, res) => {
    let decoded;
    try {
        const {token} = req.query;
        decoded = jwt.verify(token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        let data = loadData(decoded.id);
        let dishes = data.dishes;
        const id = dishes.length ? Math.max(...dishes.map(d => d.id)) + 1 : 0;
        const order = dishes.length ? Math.max(...dishes.map(d => d.order)) + 1 : 0;
        const dish = {id, order, name: '', description: '', price: '', category: 'No category'};
        data = {...data, dishes: [...dishes, dish]};
        saveDataAndPage(decoded.id, data);
        return res.status(200).json({token: prolongToken(decoded), id});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

app.put('/dishes/:id', (req, res) => {
    let decoded;
    try {
        const {token} = req.query;
        decoded = jwt.verify(token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        const dishId = parseInt(req.params.id);
        let data = loadData(decoded.id);
        let index = data.dishes.findIndex(dish => dish.id === dishId);
        if (index < 0) {
            return res.status(404).send('Dish not found');
        }
        // if (req.body.order !== undefined && req.body.order !== dish.order) {
        //     let vi = data.findIndex(dish => dish.order === req.body.order);
        //     let v = data[vi]
        //     v.order = dish.order;
        //     v = {...v, order: dish.order};
        //     data = [...data.slice(0, vi), v, ...data.slice(vi + 1)];
        // }
        data = {...data, dishes: data.dishes.map(d => d.id === dishId ? {...data.dishes[index], ...(req.body)} : d)};
        saveDataAndPage(decoded.id, data);
        return res.status(200).json({token: prolongToken(decoded)});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

app.delete('/dishes/:id', (req, res) => {
    let decoded;
    try {
        const {token} = req.query;
        decoded = jwt.verify(token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {
        const dishId = parseInt(req.params.id);
        let data = loadData(decoded.id);
        let dishIndex = data.findIndex(dish => dish.id === dishId);
        let dish = data[dishIndex];
        if (!dish) {
            return res.status(404).send('Dish not found');
        }
        data = [...data.slice(0, dishIndex), ...data.slice(dishIndex + 1)];
        saveDataAndPage(decoded.id, data);
        return res.status(200).json({token: prolongToken(decoded)});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
});

// noinspection JSUnusedGlobalSymbols
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(sitesDir, req.params.userId, 'imgs');
        fs.mkdirSync(uploadPath, {recursive: true});
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({storage: storage});

function compressInner(inputPath, outputPath, quality, percent) {
    return new Promise((resolve, reject) => {
        gm(inputPath)
            .resize(percent + '%')
            .noProfile()
            .setFormat('webp')
            .quality(quality)
            .write(outputPath, function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
    });
}

let goodSize = 50000;
let goodQuality = 50;

// async function compressAllImages(req, compressImage) {
//     const userDir = path.join(sitesDir, userId);
//     const imgsDir = path.join(userDir, 'imgs');
//     const imgs = fs.readdirSync(imgsDir);
//     for (const img of imgs) {
//         if (img.endsWith('.webp')) {
//             continue;
//         }
//         const imgPath = path.join(imgsDir, img);
//         let oldImgPath = imgPath.replace(path.extname(imgPath), '_old' + path.extname(imgPath));
//         fs.copyFileSync(imgPath, oldImgPath);
//         await compressImage(oldImgPath, imgPath);
//     }
// }

app.post('/upload/:userId/:dishId', upload.single('image'), async function (req, res) {
    let decoded;
    try {
        const {token} = req.query;
        decoded = jwt.verify(token, settings.KEY);
    } catch (error) {
        return res.status(401).send('Session expired');
    }
    try {

        const filePath = path.join(sitesDir, req.params.userId, 'imgs') + '/' + req.file.filename;

        async function compressImage(inputPath, outputPath, id) {
            try {
                let quality = 100;
                let percent = 100;
                let size;

                while (!size || size > goodSize && quality > goodQuality && percent > 0) {
                    await compressInner(inputPath, outputPath, quality, percent);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    size = fs.statSync(outputPath).size;
                    // quality -= 5;
                    percent /= 2;
                    console.log(`quality: ${quality}, percent: ${percent}%, size: ${size / 1000} kb`);
                }
                console.log(`Image compressed finished with ${quality}% quality, percent: ${percent}%, size: ${size / 1000} kb`);
            } catch (error) {
                console.error('Error compressing image:', error);
            }
        }

        let coPath1 = filePath.replace(path.extname(filePath), '_compressed' + path.extname(filePath) + '.webp');
        let coPath = req.file.filename.replace(path.extname(req.file.filename), '_compressed' + path.extname(req.file.filename) + '.webp');
        // fs.copyFileSync(filePath, coPath1);
        await compressImage(filePath, coPath1, decoded.id);


        const imgUrl = `${settings.DOMAIN}/${clientSitesPrefix}/${req.params.userId}/imgs/${coPath}`;
        let data = loadData(decoded.id);
        let dishId = parseInt(req.params.dishId);
        let dishes = data.dishes;
        let dishIndex = dishes.findIndex(dish => dish.id === dishId);
        let dish = dishes[dishIndex];
        if (!dish) {
            return res.status(404).send('Dish not found');
        }
        dish = {...dish, imgUrl};
        dishes = [...dishes.slice(0, dishIndex), dish, ...dishes.slice(dishIndex + 1)];
        data = {...data, dishes};
        saveDataAndPage(decoded.id, data);
        return res.status(200).json({token: prolongToken(decoded), imgUrl});
    } catch (error) {
        console.error(error);
        return res.status(500).send('Server error');
    }
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
