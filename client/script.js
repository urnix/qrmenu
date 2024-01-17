const isLocal = window.location.href.includes('localhost') || window.location.href.includes('file:///');
const API = isLocal ? 'http://localhost:3001' : 'https://api.m.artme.dev';
const DOMAIN = isLocal ? 'file:///Users/fen1x/dev/my/menu' : 'https://m.artme.dev/s';

let login_ = '';

document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('token')) {
        showRestaurantPage();
        await loadMenuData();
    } else {
        showLoginForm();
    }
});

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('restaurantPage').style.display = 'none';
}

function showRestaurantPage() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('restaurantPage').style.display = 'block';
}

async function login() {
    const login = document.getElementById('login').value;
    this.login_ = login;
    const password = document.getElementById('password').value;
    try {
        const response = await fetch(`${API}/`, {
            method: 'POST', headers: {'Content-Type': 'application/json',},
            body: JSON.stringify({login, password})
        });
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            showRestaurantPage();
            await loadMenuData();
        }
    } catch (error) {
        console.error(error);
        alert('Registration/login failed');
    }
}

function logout() {
    if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem('token');
        location.reload();
    }
}

async function loadMenuData() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API}/?token=${encodeURIComponent(token)}`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('restaurantName').innerHTML = `Menu of <a href="${DOMAIN}/s/${data.login}/index.html" target="_blank">${data.login}</a>`;
            document.getElementById('qrCode').src = `${DOMAIN}/s/${data.login}/qr.png`;
            populateMenuTable(data.data);
        } else {
            alert('Failed to load menu data');
        }
    } catch (error) {
        console.error(error);
        alert('Error loading menu data');
    }
}

function renderImgCell(index, imgUrl) {
    return `<input id="fileInput${index}" class="hidden" type="file" 
            onchange="uploadImage(this, '${index}')"><img class="dishImage" src="${imgUrl}" 
            onclick="document.getElementById('fileInput${index}').click()">`;
}

function populateMenuTable(dishes) {
    const table = document.getElementById('menuTable').getElementsByTagName('tbody')[0];
    dishes.forEach((dish, index) => {
        const row = table.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);
        const cell4 = row.insertCell(3);
        cell1.textContent = dish.name;
        cell2.textContent = dish.description;
        cell3.textContent = dish.price;
        cell4.innerHTML = renderImgCell(index, dish.imgUrl);
    });
}

function addDish() {
    const table = document.getElementById('menuTableBody');
    const row = table.insertRow();
    const index = table.rows.length - 1;
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);
    const cell4 = row.insertCell(3);
    cell1.innerHTML = '<input type="text" placeholder="Name">';
    cell2.innerHTML = '<input type="text" placeholder="Description">';
    cell3.innerHTML = '<input type="text" placeholder="Price">';
    cell4.innerHTML = renderImgCell(index, '');
}

async function uploadImage(input, index) {
    const file = input.files[0];
    const formData = new FormData();
    formData.append('image', file);
    try {
        const response = await fetch(`${API}/upload/${this.login_}/${index}`, {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            const result = await response.json();
            document.getElementById('menuTableBody').rows[index].cells[3].innerHTML = renderImgCell(index, result.imgUrl);
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
        let price = row.cells[2].querySelector('input')?.value || row.cells[2].textContent;
        let imgUrl = row.cells[3].querySelector('img')?.src || '';
        dishes.push({name, price, description, imgUrl});
    }

    try {
        const response = await fetch(`${API}/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dishes)
        });

        if (response.ok) {
            alert('Menu updated successfully');
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
