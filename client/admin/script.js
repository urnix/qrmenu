const isLocal = window.location.href.includes('localhost') || window.location.href.includes('file:///');
const API = isLocal ? 'http://localhost:3001' : 'https://api.menu.artme.dev';
const DOMAIN = isLocal ? 'http://localhost:8000' : 'https://menu.artme.dev';

let userId = '';
let name_ = '';
let dishes = [];
let categories = [];

function switchMode(elementClass) {
    ['loader', 'login-form', 'register-form', 'restaurant-page'].forEach(className =>
        document.getElementsByClassName(className)[0].style.display = className === elementClass ? 'block' : 'none');
}

async function register() {
    try {
        switchMode('loader');
        const name = document.querySelector('.register-form .input-name').value;
        const email = document.querySelector('.register-form .input-email').value;
        const password = document.querySelector('.register-form .input-password').value;
        const passwordConfirm = document.querySelector('.register-form .input-password-confirm').value;
        if (!name || !email || !password || !passwordConfirm) {
            throw new Error('All fields are required');
        }
        if (!/.+@.+\..+/.test(email)) {
            throw new Error('Invalid email');
        }
        if (password !== passwordConfirm) {
            throw new Error('Passwords do not match');
        }
        const response = await fetch(`${API}/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json',},
            body: JSON.stringify({name, email, password})
        });
        if (!response.ok) {
            throw new Error(await response.text());
        }
        const data = await response.json();
        if (!data || !data.id || !data.token) {
            throw new Error('Invalid server response');
        }
        userId = data.id;
        name_ = name;
        localStorage.setItem('token', data.token);
        await loadData();
    } catch (error) {
        console.error(error);
        toastFail(error);
        switchMode('register-form');
    }
}

async function login() {
    switchMode('loader');
    const email = document.querySelector('.login-form .input-email').value;
    const password = document.querySelector('.login-form .input-password').value;
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
            await loadData();
        } else {
            switchMode('login-form');
            toastFail(await response.text());
        }
    } catch (error) {
        console.error(error);
        toastFail('Login failed');
    }
}

function confirmLogout() {
    if (!confirm('Are you sure you want to log out?')) {
        return;
    }
    logout();
}

function logout() {
    userId = '';
    name_ = '';
    dishes = [];
    categories = [];
    localStorage.removeItem('token');
    location.reload();
}

async function loadData() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API}/?token=${encodeURIComponent(token)}`);
        if (response.status === 401) {
            toastFail('Session expired');
            logout()
        }
        if (!response.ok) {
            throw new Error('Failed to load menu data');
        }
        const data = await response.json();
        if (!data || !data.id || !data.name || !data.data || !data.data.categories || !Array.isArray(data.data.categories) || !data.data.dishes || !Array.isArray(data.data.dishes)) {
            throw new Error('Invalid server response');
        }
        userId = data.id;
        document.getElementById('menuLink').href = `${DOMAIN}/sites/${userId}`;
        document.getElementById('menuLink').text = `${DOMAIN}/sites/${userId}`;
        document.getElementById('qrCode').src = `${DOMAIN}/sites/${userId}/qr.png`;
        name_ = data.name;
        document.getElementById('restaurantName').innerHTML = `Welcome, ${name_}`;
        categories = data.data.categories
        drawCategories();
        dishes = data.data.dishes;
        drawDishes();
        switchMode('restaurant-page');
    } catch (error) {
        console.error(error);
        toastFail(error);
    }
}

function drawCategories() {
    const cardsContainer = document.getElementById('categories');
    cardsContainer.innerHTML = '';
    if (!categories.length) {
        let dishCard = document.createElement('h4');
        dishCard.className = 'dish-card';
        dishCard.style.boxShadow = 'none';
        dishCard.textContent = 'Add your first category by clicking the button';
        cardsContainer.appendChild(dishCard);
        return;
    }
    categories.forEach((category, index) => {
        // Card
        let cardDiv = document.createElement('div');
        cardDiv.id = `category-card-${index}`;
        cardDiv.className = `category-card`;

        // Content
        let contentDiv = document.createElement('div');
        contentDiv.className = 'content';

        // add content child div
        let contentChildDiv = document.createElement('div');
        contentChildDiv.className = 'content-child';
        contentDiv.appendChild(contentChildDiv);

        drawCategoryTextField(contentChildDiv, index, category);
        drawCategoryButtonsField(contentDiv, index, category);
        cardDiv.appendChild(contentDiv);

        // Card
        cardsContainer.appendChild(cardDiv);
    });
}

function drawCategoryTextField(card, index, category) {
    let input;
    input = document.createElement('input');
    input.type = 'text';
    input.value = category;
    input.addEventListener('change', async () => {
        categories[index] = input.value;
        return await updateCategories();
    });
    card.appendChild(input);
}

function drawCategoryButtonsField(card, index, category) {
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'buttons';

    const deleteButton = document.createElement('button');
    deleteButton.id = `delete-button-category-${index}`;
    deleteButton.className = 'delete-deleteButton-category';
    deleteButton.textContent = '🗑️';
    deleteButton.disabled = dishes.some(d => d.category === category);
    deleteButton.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete category?')) {
            return;
        }
        categories.splice(index, 1);
        await updateCategories();
    });
    buttonsDiv.appendChild(deleteButton);

    // const upButton = document.createElement('button');
    // upButton.id = `up-button-${dishId}`;
    // upButton.className = 'up-deleteButton';
    // upButton.textContent = '⬆️';
    // if (index === 0) {
    //     upButton.disabled = true;
    // }
    // upButton.addEventListener('click', async () => {
    //     document.querySelectorAll('.up-deleteButton').forEach(b => b.disabled = true);
    //     document.querySelectorAll('.down-deleteButton').forEach(b => b.disabled = true);
    //     await updateDish(dishId, 'order', order - 1);
    // });
    // // buttonsDiv.appendChild(upButton);
    //
    // const downButton = document.createElement('button');
    // downButton.id = `down-button-${dishId}`;
    // downButton.className = 'down-deleteButton';
    // downButton.textContent = '⬇️';
    // if (index === dishes.length - 1) {
    //     downButton.disabled = true;
    // }
    // downButton.addEventListener('click', async () => {
    //     document.querySelectorAll('.up-deleteButton').forEach(b => b.disabled = true);
    //     document.querySelectorAll('.down-deleteButton').forEach(b => b.disabled = true);
    //     await updateDish(dishId, 'order', order + 1);
    // });
    // // buttonsDiv.appendChild(downButton);
    card.appendChild(buttonsDiv);
}

async function addCategory() {
    categories.push('New Category');
    await updateCategories();
}

function drawTextField(card, dishId, fieldName, placeholder, value) {
    let input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener('change', async () => await updateDish(dishId, fieldName, input.value));
    card.appendChild(input);
}

function drawSelectCategoryField(card, dishId, fieldName, placeholder, value) {
    // let input = document.createElement('input');
    // input.type = 'text';
    // input.placeholder = placeholder;
    // input.value = value;
    // input.addEventListener('change', async () => await updateDish(dishId, fieldName, input.value));
    // add select
    let input = document.createElement('select');
    input.id = `select-category-${dishId}`;
    input.addEventListener('change', async () => await updateDish(dishId, fieldName, input.value));
    // add options
    categories.forEach((category) => {
        let option = document.createElement('option');
        option.value = category;
        option.text = category;
        input.appendChild(option);
    });
    // set selected
    input.value = value;

    card.appendChild(input);
}

function drawImageField(card, dishId, fieldName, placeholder, value) {
    const input = document.createElement('input');
    input.id = `fileInput${dishId}`;
    input.className = 'hidden';
    input.type = 'file';
    input.placeholder = placeholder;
    input.addEventListener('change', async () => await uploadImage(input, dishId));
    card.appendChild(input);
    const img = document.createElement('img');
    img.id = `dish-image-${dishId}`;
    img.className = 'dish-image';
    img.src = value || `${DOMAIN}/imgs/dish_placeholder.png`;
    img.alt = placeholder;
    img.onclick = () => input.click();
    card.appendChild(img);
}

function redrawImageField(dishId, value) {
    document.getElementById(`dish-image-${dishId}`).src = value;
}

function drawButtonsField(card, dishId, order, index) {
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'buttons';

    const deleteButton = document.createElement('button');
    deleteButton.id = `delete-button-${dishId}`;
    deleteButton.className = 'delete-deleteButton';
    deleteButton.textContent = '🗑️';
    deleteButton.addEventListener('click', async () => await deleteDish(dishId));
    buttonsDiv.appendChild(deleteButton);

    const upButton = document.createElement('button');
    upButton.id = `up-button-${dishId}`;
    upButton.className = 'up-deleteButton';
    upButton.textContent = '⬆️';
    if (index === 0) {
        upButton.disabled = true;
    }
    upButton.addEventListener('click', async () => {
        document.querySelectorAll('.up-deleteButton').forEach(b => b.disabled = true);
        document.querySelectorAll('.down-deleteButton').forEach(b => b.disabled = true);
        await updateDish(dishId, 'order', order - 1);
    });
    // buttonsDiv.appendChild(upButton);

    const downButton = document.createElement('button');
    downButton.id = `down-button-${dishId}`;
    downButton.className = 'down-deleteButton';
    downButton.textContent = '⬇️';
    if (index === dishes.length - 1) {
        downButton.disabled = true;
    }
    downButton.addEventListener('click', async () => {
        document.querySelectorAll('.up-deleteButton').forEach(b => b.disabled = true);
        document.querySelectorAll('.down-deleteButton').forEach(b => b.disabled = true);
        await updateDish(dishId, 'order', order + 1);
    });
    // buttonsDiv.appendChild(downButton);
    card.appendChild(buttonsDiv);
}

function drawDishes() {
    const cardsContainer = document.getElementById('menu');
    cardsContainer.innerHTML = '';
    let categoryContainer, countInCategory;
    if (!dishes.length) {
        let dishCard = document.createElement('h4');
        dishCard.className = 'dish-card';
        dishCard.style.boxShadow = 'none';
        dishCard.textContent = 'Add your first dish by clicking the button';
        cardsContainer.appendChild(dishCard);
        return;
    }
    dishes.forEach((dish, index) => {
        // Category
        if ((!index || dishes[index - 1].category !== dish.category)) {
            if (dishes.length > 1) {
                // Category Label
                let categoryLabel = document.createElement('h1');
                categoryLabel.className = 'category-label';
                categoryLabel.id = dish.category;
                categoryLabel.textContent = dish.category;
                cardsContainer.appendChild(categoryLabel);
            }

            countInCategory = 0;
            categoryContainer = document.createElement('div');
            categoryContainer.className = 'category-container';
        }

        // Card
        let cardDiv = document.createElement('div');
        cardDiv.id = `dish-card-${dish.id}`;
        cardDiv.className = `dish-card`;
        countInCategory++;

        // Image
        drawImageField(cardDiv, dish.id, 'imgUrl', 'Image', dish.imgUrl);

        // Content
        let contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        drawTextField(contentDiv, dish.id, 'name', 'Dish Name', dish.name);
        drawTextField(contentDiv, dish.id, 'description', 'Description', dish.description);
        drawSelectCategoryField(contentDiv, dish.id, 'category', 'Category', dish.category);
        drawTextField(contentDiv, dish.id, 'price', 'Price', dish.price);
        drawButtonsField(contentDiv, dish.id, dish.order, index);
        cardDiv.appendChild(contentDiv);

        // Card
        categoryContainer.appendChild(cardDiv);

        // Category
        if (index === dishes.length - 1 || dish.category !== dishes[index + 1].category) {
            // Fillers
            let fillersCount = countInCategory % 12 ? 12 - (countInCategory % 12) : 0;
            for (let i = 0; i < fillersCount; i++) {
                let cardFillerDiv = document.createElement('div');
                cardFillerDiv.className = 'dish-card dish-card-filler';
                categoryContainer.appendChild(cardFillerDiv);
            }
            // Category
            cardsContainer.appendChild(categoryContainer);
        }
    });
}

function changeField(dishId, fieldName, value) {
    let dishIndex = dishes.findIndex(d => d.id === dishId);
    let dish = dishes[dishIndex];
    dish = {...dish, [fieldName]: value};
    dishes = [...dishes.slice(0, dishIndex), dish, ...dishes.slice(dishIndex + 1)];
}

async function uploadImage(input, dishId) {
    if (!input.files.length) {
        toastFail('No file selected');
        return;
    }
    const formData = new FormData();
    formData.append('image', input.files[0]);
    changeField(dishId, 'imgUrl', '../imgs/loader.svg');
    redrawImageField(dishId, '../imgs/loader.svg');
    try {
        const response = await fetch(`${API}/upload/${userId}/${dishId}/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            toastFail('Failed to upload image');
            return;
        } else if (response.status === 401) {
            toastFail('Session expired');
            this.logout()
        }
        const data = await response.json();
        if (!data.hasOwnProperty('imgUrl')) {
            toastFail('Unexpected server response');
            return;
        }
        changeField(dishId, 'imgUrl', data.imgUrl);
        redrawImageField(dishId, data.imgUrl);
    } catch (error) {
        toastFail('Error uploading image');
    }
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function updateCategories() {
    let addButton = document.getElementById('add-category-button');
    document.querySelectorAll('#categories input').forEach(i => i.disabled = true);
    document.querySelectorAll('#categories button').forEach(b => b.disabled = true);
    try {
        addButton.disabled = true;
        const response = await fetch(`${API}/categories/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({value: JSON.stringify(categories)})
            }
        );
        // 401 error
        if (response.status === 401) {
            toastFail('Session expired');
            logout()
        }
        if (!response.ok) {
            throw new Error('Failed to update categories');
        }
            drawCategories();
            await loadData();

    } catch (error) {
        console.error(error);
        toastFail(error);
    } finally {
        addButton.disabled = false;
    }
}

async function addDish() {
    let addButton = document.getElementById('add-dish-button');
    try {
        addButton.disabled = true;
        const response = await fetch(`${API}/dishes/?token=${encodeURIComponent(localStorage.getItem('token'))}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
            }
        );
        if (response.ok) {
            await loadData();
            setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 1);
        } else if (response.status === 401) {
            toastFail('Session expired');
            logout()
        } else {
            toastFail('Failed to add dish');
        }
    } catch (error) {
        console.error(error);
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
            if (fieldName === 'order') {
                await loadData();
            }
            if (fieldName === 'category') {
                await loadData();
                window.location.hash = `#${value}`;
                toastSuccess('Dish moved to another category');
            }
        } else if (response.status === 401) {
            toastFail('Session expired');
            logout()
        } else {
            toastFail(`Failed to update ${capitalize(fieldName)}`);
        }
    } catch (error) {
        toastFail(`Error updating ${capitalize(fieldName)}`);
    } finally {
        document.querySelectorAll('.up-button').forEach((b, i) => b.disabled = i === 0);
        document.querySelectorAll('.down-button').forEach((b, i, p) => b.disabled = i === p.length - 1);
    }
}

async function deleteDish(dishId) {
    if (!confirm('Are you sure you want to delete dish?')) {
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
            if (dishes.length === 1) {
                dishes = [];
                drawDishes();
                return;
            }
            let dishIndex = dishes.findIndex(d => d.id === dishId);
            dishes = [...dishes.slice(0, dishIndex), ...dishes.slice(dishIndex + 1)];
            document.getElementById(`dish-card-${dishId}`).remove();
        } else if (response.status === 401) {
            toastFail('Session expired');
            logout()
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
    new Toast(message, ToastType.Success, 30000);
}

function toastFail(message) {
    new Toast(message, ToastType.Danger, 30000);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('token')) {
        switchMode('loader');
        await loadData();
    } else {
        switchMode('login-form');
    }
});
