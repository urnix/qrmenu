const API = 'https://api.m.artme.dev';
const DOMAIN = 'https://m.artme.dev';
// const API = 'http://localhost:3001';
// const DOMAIN = '/Users/fen1x/dev/my/menu';


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
    const password = document.getElementById('password').value;
    try {
        const response = await fetch(`${API}/`, {
            method: 'POST', headers: {
                'Content-Type': 'application/json',
            }, body: JSON.stringify({login, password})
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            showRestaurantPage();
            await loadMenuData();
        } else {
            alert('Login failed');
        }
    } catch (error) {
        alert('Error logging in');
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

function populateMenuTable(dishes) {
    const table = document.getElementById('menuTable');
    dishes.forEach(dish => {
        const row = table.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        cell1.textContent = dish.name;
        cell2.textContent = dish.price;
    });
}

function addDish() {
    const table = document.getElementById('menuTable');
    const row = table.insertRow();
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    cell1.innerHTML = '<input type="text" placeholder="Dish name">';
    cell2.innerHTML = '<input type="text" placeholder="Price">';
}

async function updateMenu() {
    const token = localStorage.getItem('token');
    const table = document.getElementById('menuTable');
    let dishes = [];
    for (let i = 1; i < table.rows.length; i++) {
        let row = table.rows[i];
        let name = row.cells[0].querySelector('input')?.value || row.cells[0].textContent;
        let price = row.cells[1].querySelector('input')?.value || row.cells[1].textContent;
        dishes.push({name, price});
    }

    try {
        const response = await fetch(`${API}/?token=${encodeURIComponent(token)}`, {
            method: 'PUT', headers: {
                'Content-Type': 'application/json',
            }, body: JSON.stringify(dishes)
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
