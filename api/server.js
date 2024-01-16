// TODO: fs sync -> async

const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const QRCode = require('qrcode');
const path = require('path');

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
    const htmlContent = `
    <html lang="ru">
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
     body, h1, button, p {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}

header {
  background-color: #000;
  color: #fff;
  text-align: center;
  padding: 20px;
}

nav {
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
  background: #333;
}

nav button {
  background: none;
  border: none
  border: none;
  color: #fff;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}

nav button:focus, nav button:hover {
  background: #555;
}

main {
  padding: 20px;
}

#menu {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
#menu .dish-card {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.dish-card {
  display: flex;
  justify-content: space-between;
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  margin-bottom: 20px; /* Add space between cards */
}

.dish-card img {
  height: 150px;
  width: auto; /* Adjust width automatically */
  border-radius: 10px; /* Optional: if you want rounded corners on images */
  margin-left: 15px; /* Add some space between the image and the border */
}

.dish-card .content {
  padding: 15px;
  flex-grow: 1; /* Content takes up remaining space */
}

/* Additional styles for the content */
.dish-card .content h3 {
  margin: 0 0 10px 0; /* Add some margin below the title */
  color: #333;
}

.dish-card .content p {
  margin: 0; /* Remove margin from paragraphs */
  color: #666;
}

/* Ensure the image floats right */
.dish-card .content {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Update footer styles if needed */
footer {
  text-align: center;
  padding: 20px;
  background: #f2f2f2;
}

footer button {
  background: #4CAF50;
  border: none;
  padding: 10px 15px;
  color: white;
  font-size: 18px;
  border-radius: 5px;
  cursor: pointer;
}

footer p {
  margin-top: 10px;
  color: #333;
}


</style>
</head>
<body>
  <header>
    <h1>${login}</h1>
  </header>
  <main>
    <section id="menu">
      ${menu}
    </section>
  </main>
</body>
</html>
`;
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
    const exampleData = new Array(100).fill(0).map((_, i) => ({
        name: 'Dish' + i,
        description: 'Description' + i,
        price: '10' + i,
        imgUrl: '../dish_placeholder.png?q=' + i
    }));
    fs.writeFileSync(`${sitesDir}/${login}/data.json`, JSON.stringify(exampleData));
    saveMenuPage(login, '<p>There are no dishes yet</p>');
    generateQRCode(login);

    return res.status(200).json({token});
});

app.get('/', (req, res) => {
    try {
        const {token} = req.query;
        const decoded = jwt.verify(token, settings.KEY);
        const data = fs.readFileSync(`${sitesDir}/${decoded.login}/data.json`, 'utf8');
        return res.status(200).json({token: prolongToken(decoded), login: decoded.login, data: JSON.parse(data)});
    } catch (error) {
        return res.status(401).send('Session expired');
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

        saveMenuPage(decoded.login, `<table>${generateMenuTable(data)}</table>`);

        return res.status(200).json({token: prolongToken(decoded)});
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
