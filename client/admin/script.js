const isLocal = window.location.href.includes('localhost') || window.location.href.includes('file:///');
const API = isLocal ? 'http://localhost:3001' : 'https://api.menu.artme.dev';
const DOMAIN = isLocal ? 'file:///Users/fen1x/dev/my/menu/client' : 'https://menu.artme.dev';

let id_ = '';
let name_ = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('token')) {
        showLoader();
        await loadData();
    } else {
        showLoginForm();
    }
});

function showLoader() {
    document.getElementById('loader').style.display = 'block';
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('restaurantPage').style.display = 'none';
}

function showRegisterForm() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('restaurantPage').style.display = 'none';
}

function showLoginForm() {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('restaurantPage').style.display = 'none';
}

function showEditor() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loader').style.display = 'none';
    document.getElementById('restaurantPage').style.display = 'block';
}

async function register(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    event.cancelBubble = true;
    event.returnValue = false;
    showLoader();
    const name = document.querySelector('#registerForm .input-name').value;
    const email = document.querySelector('#registerForm .input-email').value;
    const password = document.querySelector('#registerForm .input-password').value;
    const passwordConfirm = document.querySelector('#registerForm .input-passwordConfirm').value;
    if (!name || !email || !password || !passwordConfirm) {
        alert('All fields are required');
        return;
    }
    if (!/.+@.+\..+/.test(email)) {
        alert('Invalid email');
        return;
    }
    if (password !== passwordConfirm) {
        alert('Passwords do not match');
        return;
    }
    try {
        const response = await fetch(`${API}/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json',},
            body: JSON.stringify({name, email, password})
        });
        if (response.ok) {
            const data = await response.json();
            id_ = data.id;
            name_ = name;
            localStorage.setItem('token', data.token);
            await loadData();
        } else {
            alert(await response.text());
            showRegisterForm();
        }
    } catch (error) {
        console.error(error);
        alert('Registration failed');
    }
}

async function login(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    event.cancelBubble = true;
    event.returnValue = false;
    showLoader()
    const email = document.querySelector('#loginForm .input-email').value;
    const password = document.querySelector('#loginForm .input-password').value;
    try {
        const response = await fetch(`${API}/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json',},
            body: JSON.stringify({email, password})
        });
        if (response.ok) {
            const data = await response.json();
            id_ = data.id;
            name_ = data.name;
            localStorage.setItem('token', data.token);
            await loadData(showEditor);
        } else {
            showLoginForm();
            await new Promise(resolve => setTimeout(resolve, 1));
            alert(await response.text());
        }
    } catch (error) {
        console.error(error);
        alert('Login failed');
    }
}

function confirmLogout() {
    if (isLocal || confirm('Are you sure you want to log out?')) {
        this.logout();
    }
}

function logout() {
    id_ = '';
    name_ = '';
    localStorage.removeItem('token');
    location.reload();
}

async function loadData(callback) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API}/?token=${encodeURIComponent(token)}`);
        if (response.ok) {
            const data = await response.json();
            id_ = data.id;
            name = data.name;
            document.getElementById('restaurantName').innerHTML = `Menu of <a href="${DOMAIN}/sites/${data.id}/index.html" target="_blank">${data.name}</a>`;
            document.getElementById('qrCode').src = `${DOMAIN}/sites/${data.id}/qr.png`;
            populateMenuTable(data.data);
            showEditor();
        } else if (response.status === 401) {
            alert('Session expired');
            this.logout()
        } else {
            console.error(response);
            alert('Failed to load menu data');
        }
    } catch (error) {
        console.error(error);
        alert('Error loading menu data');
    }
}

function renderImgCell(index, imgUrl) {
    return `<input id="fileInput${index}" class="hidden" type="file" 
            onchange="uploadImage(this, '${index}')"><img class="dishImage" src="${imgUrl || `${DOMAIN}/imgs/dish_placeholder.png`}"
            alt="Image" onclick="document.getElementById('fileInput${index}').click()">`;
}

function populateMenuTable(dishes) {
    const table = document.getElementById('menuTable').getElementsByTagName('tbody')[0];
    dishes.forEach((dish, index) => {
        const row = table.insertRow();
        row.insertCell(0).innerHTML = `<input type="text" placeholder="Dish Name" value="${dish.name}">`
        row.insertCell(1).innerHTML = `<input type="text" placeholder="Description" value="${dish.description}">`
        row.insertCell(2).innerHTML = `<input type="text" placeholder="Dish Name" value="${dish.category}">`
        row.insertCell(3).innerHTML = `<input type="text" placeholder="Dish Name" value="${dish.price}">`
        row.insertCell(4).innerHTML = renderImgCell(index, dish.imgUrl);
    });
}

function addDish() {
    const table = document.getElementById('menuTableBody');
    const row = table.insertRow();
    const index = table.rows.length - 1;
    row.insertCell(0).innerHTML = '<input type="text" placeholder="Name">';
    row.insertCell(1).innerHTML = '<input type="text" placeholder="Description">';
    row.insertCell(2).innerHTML = '<input type="text" placeholder="Category">';
    row.insertCell(3).innerHTML = '<input type="text" placeholder="Price">';
    row.insertCell(4).innerHTML = renderImgCell(index, '');
}

async function uploadImage(input, index) {
    const file = input.files[0];
    const formData = new FormData();
    formData.append('image', file);
    try {
        const response = await fetch(`${API}/upload/${id_}/${index}`, {method: 'POST', body: formData});
        if (response.ok) {
            const result = await response.json();
            document.getElementById('menuTableBody').rows[index].cells[4].innerHTML = renderImgCell(index, result.imgUrl);
        } else if (response.status === 401) {
            alert('Session expired');
            this.logout()
        } else {
            alert('Failed to upload image');
        }
    } catch (error) {
        alert('Error uploading image');
    }
}

async function updateMenu() {
    const table = document.getElementById('menuTableBody');
    let dishes = [];
    for (let i = 0; i < table.rows.length; i++) {
        let row = table.rows[i];
        let name = row.cells[0].querySelector('input')?.value || row.cells[0].textContent;
        let description = row.cells[1].querySelector('input')?.value || row.cells[1].textContent;
        let category = row.cells[2].querySelector('input')?.value || row.cells[2].textContent;
        let price = row.cells[3].querySelector('input')?.value || row.cells[3].textContent;
        let src = row.cells[4].querySelector('img')?.src;
        let imgUrl = src || '';
        dishes.push({name, description, category, price, imgUrl});
    }
    try {
        const response = await fetch(`${API}/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dishes)
        });

        if (response.ok) {
            alert('Menu updated successfully');
        } else if (response.status === 401) {
            alert('Session expired');
            this.logout()
        } else {
            alert('Failed to update menu');
        }
    } catch (error) {
        alert('Error updating menu');
    }
}

function openQRCode() {
    window.open(document.getElementById('qrCode').src, '_blank');
}
