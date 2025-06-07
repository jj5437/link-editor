const API_BASE_URL = '/link-api';
const USERS_PER_PAGE = 6;

let allUsers = [];
let filteredUsers = [];
let currentPage = 1;

// Simple router based on pathname
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path === '/' || path.endsWith('index.html')) {
        handleLoginPage();
    } else if (path.endsWith('dashboard.html')) {
        handleDashboardPage();
    }
});

function handleLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { username, password } = e.target.elements;
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = '';

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.value, password: password.value }),
            });

            if (response.ok) {
                window.location.href = '/dashboard.html';
            } else {
                const error = await response.json();
                errorMessage.textContent = error.message || '登录失败';
            }
        } catch (error) {
            errorMessage.textContent = '发生网络错误，请重试。';
        }
    });
}

async function handleDashboardPage() {
    const usersContainer = document.getElementById('users-container');
    const logoutBtn = document.getElementById('logout-btn');
    const searchBox = document.getElementById('search-box');
    if (!usersContainer || !logoutBtn || !searchBox) return;

    logoutBtn.addEventListener('click', async () => {
        await fetch('/logout', { method: 'POST' });
        window.location.href = '/index.html';
    });

    searchBox.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filteredUsers = allUsers.filter(user => user.username.toLowerCase().includes(searchTerm));
        currentPage = 1;
        renderDashboard();
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}/users`);
        if (!response.ok) {
            if (response.status === 401) window.location.href = '/index.html';
            throw new Error('获取用户数据失败。');
        }

        const allFetchedUsers = await response.json();
        // Filter users to only include those with existing link mappings.
        allUsers = allFetchedUsers.filter(user => 
            user.preferences &&
            Array.isArray(user.preferences.linkMappings) &&
            user.preferences.linkMappings.length > 0
        );
        filteredUsers = allUsers;
        renderDashboard();

    } catch (error) {
        console.error(error);
        usersContainer.innerHTML = `<p style="color: #ff4757;">无法加载用户数据，您可能需要重新登录。</p>`;
        setTimeout(() => { window.location.href = '/index.html' }, 2000);
    }
}

function renderDashboard() {
    renderUsers();
    renderPagination();
}

function renderUsers() {
    const usersContainer = document.getElementById('users-container');
    usersContainer.innerHTML = '';

    if (filteredUsers.length === 0) {
        usersContainer.innerHTML = '<p>未找到匹配的用户。</p>';
        return;
    }
    
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    const endIndex = startIndex + USERS_PER_PAGE;
    const usersToShow = filteredUsers.slice(startIndex, endIndex);

    usersToShow.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.dataset.username = user.username;

        let linkMappings = user.preferences?.linkMappings;
        if (!Array.isArray(linkMappings)) linkMappings = [];
        
        const linksHtml = linkMappings.map((mapping, index) => renderLinkTextarea(user.username, index, mapping.links || '')).join('');
        
        userCard.innerHTML = `
            <div class="user-card-header">
                <h3>${user.username}</h3>
            </div>
            <div class="links-wrapper">${linksHtml || '<p class="subtle-text-color">该用户暂无链接，请联系管理员添加链接映射。</p>'}</div>
            <button class="save-btn" data-username="${user.username}">保存 ${user.username} 的链接</button>
        `;
        usersContainer.appendChild(userCard);
    });

    document.querySelectorAll('.save-btn').forEach(b => b.addEventListener('click', handleSave));
    document.querySelectorAll('.add-link-btn').forEach(b => b.addEventListener('click', handleAddLink));
}

function renderPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous Button
    const prevButton = document.createElement('button');
    prevButton.textContent = '上一页';
    prevButton.className = 'page-btn';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderDashboard();
        }
    });
    paginationContainer.appendChild(prevButton);

    // Page number buttons (simplified for brevity)
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = 'page-btn' + (i === currentPage ? ' active' : '');
        pageButton.addEventListener('click', () => {
            currentPage = i;
            renderDashboard();
        });
        paginationContainer.appendChild(pageButton);
    }

    // Next Button
    const nextButton = document.createElement('button');
    nextButton.textContent = '下一页';
    nextButton.className = 'page-btn';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderDashboard();
        }
    });
    paginationContainer.appendChild(nextButton);
}

function renderLinkTextarea(username, index, content) {
    return `<div class="links-container">
                <textarea data-username="${username}" data-index="${index}" placeholder="每行一个链接...">${content}</textarea>
            </div>`;
}

function handleAddLink(event) {
    const username = event.target.dataset.username;
    const userCard = document.querySelector(`.user-card[data-username="${username}"]`);
    const linksWrapper = userCard.querySelector('.links-wrapper');
    
    // If it's the placeholder text, remove it first
    if (linksWrapper.querySelector('p')) {
        linksWrapper.innerHTML = '';
    }

    const newIndex = linksWrapper.children.length;
    const newTextareaHtml = renderLinkTextarea(username, newIndex, '');
    linksWrapper.insertAdjacentHTML('beforeend', newTextareaHtml);
}

async function handleSave(event) {
    const username = event.target.dataset.username;
    const textareas = document.querySelectorAll(`.user-card[data-username="${username}"] textarea`);
    const newLinkMappings = Array.from(textareas).map(ta => ({ links: ta.value }));
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '保存中...';
    button.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/users/${username}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkMappings: newLinkMappings }),
        });

        if (response.ok) {
            button.textContent = '保存成功!';
            button.style.backgroundColor = 'var(--success-color)';
        } else {
            const error = await response.json();
            button.textContent = `保存失败`;
            button.style.backgroundColor = 'var(--danger-color)';
            alert(`保存失败: ${error.message}`);
        }
    } catch (error) {
        button.textContent = '保存出错';
        button.style.backgroundColor = 'var(--danger-color)';
        alert('保存过程中发生错误。');
    } finally {
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
            button.style.backgroundColor = '';
        }, 2000);
    }
} 