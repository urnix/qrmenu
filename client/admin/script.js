const isLocal = window.location.href.includes('localhost') || window.location.href.includes('file:///');
const API = isLocal ? 'http://localhost:3001' : 'https://api.menu.artme.dev';
const DOMAIN = isLocal ? 'file:///Users/fen1x/dev/my/menu/client' : 'https://menu.artme.dev';

let userId = '';
let name_ = '';
let updateInProcess = false;

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
        toastFail('All fields are required');
        return;
    }
    if (!/.+@.+\..+/.test(email)) {
        toastFail('Invalid email');
        return;
    }
    if (password !== passwordConfirm) {
        toastFail('Passwords do not match');
        return;
    }
    try {
        const response = await fetch(`${API}/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json',},
            body: JSON.stringify({name, email, password})
        });
        if (response.ok) {
            const data = await response.json();
            userId = data.id;
            name_ = name;
            localStorage.setItem('token', data.token);
            await loadData();
        } else {
            toastFail(await response.text());
            showRegisterForm();
        }
    } catch (error) {
        console.error(error);
        toastFail('Registration failed');
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
            userId = data.id;
            name_ = data.name;
            localStorage.setItem('token', data.token);
            await loadData(showEditor);
        } else {
            showLoginForm();
            toastFail(await response.text());
        }
    } catch (error) {
        console.error(error);
        toastFail('Login failed');
    }
}

function confirmLogout() {
    if (!isLocal && !confirm('Are you sure you want to log out?')) {
        return;
    }
    this.logout();
}

function logout() {
    userId = '';
    name_ = '';
    localStorage.removeItem('token');
    location.reload();
}

async function loadData(dishId, fieldName) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API}/?token=${encodeURIComponent(token)}`);
        if (response.ok) {
            const data = await response.json();
            userId = data.id;
            name = data.name;
            document.getElementById('restaurantName').innerHTML = `Menu of <a href="${DOMAIN}/sites/${data.id}/index.html" target="_blank">${data.name}</a>`;
            document.getElementById('qrCode').src = `${DOMAIN}/sites/${data.id}/qr.png`;
            populateMenuTable(data.data, dishId, fieldName);
            showEditor();
        } else if (response.status === 401) {
            toastFail('Session expired');
            this.logout()
        } else {
            console.error(response);
            toastFail('Failed to load menu data');
        }
    } catch (error) {
        console.error(error);
        toastFail('Error loading menu data');
    }
}

function renderTextCell(htmlTableCellElement, dishId, fieldName, placeholder, value, update = false) {
    if (update) {
        let existingInput = htmlTableCellElement.querySelector('input');
        existingInput.value = value;
        existingInput.disabled = false;
        return;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener('change', async () => {
        const t = setInterval(async () => {
            if (updateInProcess) {
                return;
            }
            updateInProcess = true;
            input.disabled = true;
            await updateDish(dishId, fieldName, input.value);
            clearInterval(t);
            updateInProcess = false;
        }, 100);
    });
    htmlTableCellElement.appendChild(input);
}

function renderImgCell(htmlTableCellElement, dishId, fieldName, placeholder, value, update = false) {
    if (update) {
        let existingImg = htmlTableCellElement.querySelector('img');
        existingImg.src = value || `${DOMAIN}/imgs/dish_placeholder.png`;
        existingImg.disabled = false;
        return;
    }
    const input = document.createElement('input');
    input.id = `fileInput${dishId}`;
    input.className = 'hidden';
    input.type = 'file';
    input.placeholder = placeholder;
    input.addEventListener('change', async () => await uploadImage(input, dishId));
    htmlTableCellElement.appendChild(input);
    const img = document.createElement('img');
    img.className = 'dishImage';
    img.src = value || `${DOMAIN}/imgs/dish_placeholder.png`;
    img.alt = placeholder;
    img.onclick = () => input.click();
    htmlTableCellElement.appendChild(img);
}

function renderDelCell(htmlTableCellElement, dishId) {
    const button = document.createElement('button');
    button.id = `delete-button-${dishId}`;
    button.className = 'delete-button';
    button.textContent = 'Delete';
    button.addEventListener('click', async () => await deleteDish(dishId));
    htmlTableCellElement.appendChild(button);
}

function populateMenuTable(dishes, dishId, fieldName) {
    const table = document.getElementById('menuTable').getElementsByTagName('tbody')[0];
    if (!dishId) {
        table.innerHTML = '';
    }
    if (dishId && !fieldName) {
        const row = table.insertRow();
        row.id = `dish-row-${dishId}`;
        let dish1 = dishes.find(d => d.id === dishId);
        if (dish1) {
            renderTextCell(row.insertCell(0), dishId, 'name', 'Dish Name', dish1.name);
            renderTextCell(row.insertCell(1), dishId, 'description', 'Description', dish1.description);
            renderTextCell(row.insertCell(2), dishId, 'category', 'Category', dish1.category);
            renderTextCell(row.insertCell(3), dishId, 'price', 'Price', dish1.price);
            renderImgCell(row.insertCell(4), dishId, 'imgUrl', 'Image', dish1.imgUrl);
            renderDelCell(row.insertCell(5), dishId);
        } else {
            document.getElementById(`dish-row-${dishId}`).remove();
        }
    }
    dishes.forEach((dish) => {
        if (!dishId) {
            const row = table.insertRow();
            row.id = `dish-row-${dish.id}`;
            renderTextCell(row.insertCell(0), dish.id, 'name', 'Dish Name', dish.name);
            renderTextCell(row.insertCell(1), dish.id, 'description', 'Description', dish.description);
            renderTextCell(row.insertCell(2), dish.id, 'category', 'Category', dish.category);
            renderTextCell(row.insertCell(3), dish.id, 'price', 'Price', dish.price);
            renderImgCell(row.insertCell(4), dish.id, 'imgUrl', 'Image', dish.imgUrl);
            renderDelCell(row.insertCell(5), dish.id);
        } else if (dish.id === dishId) {
            const row = document.getElementById(`dish-row-${dishId}`);
            if (fieldName === 'name') {
                renderTextCell(row.cells[0], dish.id, 'name', 'Dish Name', dish.name, true);
            }
            if (fieldName === 'description') {
                renderTextCell(row.cells[1], dish.id, 'description', 'Description', dish.description, true);
            }
            if (fieldName === 'category') {
                renderTextCell(row.cells[2], dish.id, 'category', 'Category', dish.category, true);
            }
            if (fieldName === 'price') {
                renderTextCell(row.cells[3], dish.id, 'price', 'Price', dish.price, true);
            }
            if (fieldName === 'imgUrl') {
                renderImgCell(row.cells[4], dish.id, 'imgUrl', 'Image', dish.imgUrl, true);
            }
        }
    });
}

async function uploadImage(input, dishId) {
    const formData = new FormData();
    formData.append('image', input.files[0]);
    try {
        const response = await fetch(`${API}/upload/${userId}/${dishId}/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
                method: 'POST',
                body: formData
            }
        );
        if (response.ok) {
            await loadData(dishId, 'imgUrl');
            toastSuccess('Image updated');
        } else if (response.status === 401) {
            toastFail('Session expired');
            this.logout()
        } else {
            toastFail('Failed to upload image');
        }
    } catch (error) {
        toastFail('Error uploading image');
    }
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}


async function addDish() {
    let addButton = document.getElementById('add-dish-button');
    try {
        addButton.disabled = true;
        const dish = {name: '', description: '', category: '', price: '', imgUrl: ''};
        const response = await fetch(`${API}/dishes/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(dish)
            }
        );
        if (response.ok) {
            const data = await response.json();
            await loadData(data.id);
            toastSuccess(`Dish added`);
        } else if (response.status === 401) {
            toastFail('Session expired');
            this.logout()
        } else {
            toastFail('Failed to add dish');
        }
    } catch (error) {
        toastFail('Error adding dish');
    } finally {
        addButton.disabled = false;
    }
}

async function updateDish(dishId, fieldName, value) {
    try {
        const response = await fetch(`${API}/dishes/${dishId}/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({[fieldName]: value})
            }
        );
        if (response.ok) {
            await loadData(dishId, fieldName);
            toastSuccess(`${capitalize(fieldName)} updated`);
        } else if (response.status === 401) {
            toastFail('Session expired');
            this.logout()
        } else {
            toastFail(`Failed to update ${capitalize(fieldName)}`);
        }
    } catch (error) {
        toastFail(`Error updating ${capitalize(fieldName)}`);
    }
}

async function deleteDish(dishId) {
    if (!isLocal && !confirm('Are you sure you want to delete dish?')) {
        return;
    }
    let deleteButton = document.getElementById(`delete-button-${dishId}`);
    try {
        deleteButton.disabled = true;
        const response = await fetch(`${API}/dishes/${dishId}/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
            }
        );
        if (response.ok) {
            await loadData(dishId);
            toastSuccess(`Dish deleted`);
        } else if (response.status === 401) {
            toastFail('Session expired');
            this.logout()
        } else {
            toastFail(`Failed to delete dish`);
        }
    } catch (error) {

        toastFail(`Error deleting dish`);
    } finally {
        deleteButton.disabled = true;
    }
}


function openQRCode() {
    window.open(document.getElementById('qrCode').src, '_blank');
}

class Toast {
    constructor(message, color, time) {
        const element = document.createElement('div');
        element.className = "toast";
        element.style.backgroundColor = color;
        element.innerHTML = message;
        let marginBottom = 5;
        Array.from(document.getElementsByClassName("toast"))
            .forEach((e) => marginBottom += e.clientHeight + 5);
        element.style.marginBottom = marginBottom + "px";
        document.body.appendChild(element);
        setTimeout(() => element.remove(), time);
    }
}

const ToastType = {
    Danger: "#eb3b5a",
    Warning: "#fdcb6e",
    Success: "#00b894",
}

function toastSuccess(message) {
    new Toast(message, ToastType.Success, 3000);
}

function toastFail(message) {
    new Toast(message, ToastType.Danger, 3000);
}
