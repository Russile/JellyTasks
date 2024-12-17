// Constants for authentication
const SCOPES = 'https://www.googleapis.com/auth/tasks';
const CHROME_CLIENT_ID = '968650810400-4jansfh2dodn49tq3nphs1gfm7ekdj3e.apps.googleusercontent.com';
const EDGE_CLIENT_ID = '968650810400-070t7ss5oifrshktijtl3j3pt6g3dsgm.apps.googleusercontent.com';
const isEdge = navigator.userAgent.includes('Edg');
const CLIENT_ID = isEdge ? EDGE_CLIENT_ID : CHROME_CLIENT_ID;

// Token validation function
async function validateToken(token) {
    try {
        const response = await fetch(
            'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            }
        );
        return response.ok;
    } catch (error) {
        console.error('Error validating token:', error);
        return false;
    }
}

// Initialize variables for DOM Elements
let taskListsContainer;
let tasksContainer;
let newTaskForm;
let newTaskTitle;
let newTaskNotes;
let newTaskDate;
let taskListSelect;
let addTaskButton;
let saveTaskButton;
let cancelTaskButton;
let loginPrompt;
let loginButton;
let currentTaskList = '@default';
let accessToken = null;
let editTaskForm;
let editTaskTitle;
let editTaskNotes;
let editTaskDate;
let updateTaskButton;
let cancelEditButton;
let clearCompletedButton;
let currentEditingTaskId = null;

// Config menu elements
let configButton;
let configMenu;
let listSelection;
let saveConfigButton;
let closeConfigButton;
let selectAllButton;
let selectedLists = [];
let allLists = [];

// Add this to your global variables
let listColors = {};
let activeColorPicker = null;

// Add color palette array
const COLOR_PALETTE = [
    '#1a73e8', // Blue
    '#d93025', // Red
    '#188038', // Green
    '#9334e6', // Purple
    '#f29900', // Orange
    'custom'   // Custom color picker
];

// Add the delete list function at the top level of the script
window.deleteList = async function(listId, listTitle) {
    if (!confirm(`Are you sure you want to delete "${listTitle}"? All tasks in this list will be deleted.`)) {
        return;
    }

    try {
        const response = await fetch(
            `https://tasks.googleapis.com/tasks/v1/users/@me/lists/${listId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Remove from selectedLists
        selectedLists = selectedLists.filter(id => id !== listId);
        await saveSelectedLists();

        // Refresh the lists display
        await loadTaskListsForConfig();
        
        // If we deleted the current list, switch to the default list
        if (currentTaskList === listId) {
            currentTaskList = selectedLists[0];
            await loadAllTasks();
        }
    } catch (error) {
        console.error('Error deleting list:', error);
        alert('Failed to delete list. Please try again.');
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing extension');
    await initializeExtension();
});

async function initializeExtension() {
    console.log('Initializing extension');
    if (!initializeDOMElements()) {
        console.error('Failed to initialize DOM elements');
        return;
    }

    // Load saved colors
    const storage = await chrome.storage.local.get(['listColors']);
    listColors = storage.listColors || {};

    console.log('Initializing DOM elements');
    initializeEventListeners();

    // Check if we have a valid token
    try {
        if (isEdge) {
            // For Edge, check stored token
            const result = await chrome.storage.local.get(['accessToken']);
            if (result.accessToken) {
                console.log('Found existing token in Edge');
                accessToken = result.accessToken;
                loginPrompt.style.display = 'none';
                document.querySelector('.container').classList.remove('hidden');
                await loadSelectedLists();
                await loadAllTasks();
            } else {
                console.log('No token found in Edge, showing login prompt');
                loginPrompt.style.display = 'flex';
                document.querySelector('.container').classList.add('hidden');
            }
        } else {
            // For Chrome, test the token first
            const token = await new Promise((resolve) => {
                chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
                    resolve(token);
                });
            });

            if (token) {
                // Test if the token actually works
                const testResponse = await fetch(
                    'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    }
                );

                if (testResponse.ok) {
                    console.log('Found valid token in Chrome');
                    accessToken = token;
                    loginPrompt.style.display = 'none';
                    document.querySelector('.container').classList.remove('hidden');
                    await loadSelectedLists();
                    await loadAllTasks();
                } else {
                    console.log('Token invalid, removing and showing login');
                    // Remove the invalid token
                    chrome.identity.removeCachedAuthToken({ 'token': token });
                    await chrome.storage.local.clear();
                    accessToken = null;
                    loginPrompt.style.display = 'flex';
                    document.querySelector('.container').classList.add('hidden');
                }
            } else {
                console.log('No token found in Chrome, showing login prompt');
                loginPrompt.style.display = 'flex';
                document.querySelector('.container').classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error checking auth token:', error);
        // On any error, clear everything and show login
        if (!isEdge) {
            await chrome.storage.local.clear();
            if (accessToken) {
                chrome.identity.removeCachedAuthToken({ 'token': accessToken });
            }
        }
        accessToken = null;
        loginPrompt.style.display = 'flex';
        document.querySelector('.container').classList.add('hidden');
    }
}

function initializeDOMElements() {
    console.log('Initializing DOM elements');
    
    // Make sure container is visible
    const container = document.querySelector('.container');
    if (container) {
        container.classList.remove('hidden');
        console.log('Container made visible');
    }

    taskListsContainer = document.getElementById('taskLists');
    tasksContainer = document.getElementById('tasks');
    newTaskForm = document.getElementById('newTaskForm');
    newTaskTitle = document.getElementById('newTaskTitle');
    newTaskNotes = document.getElementById('newTaskNotes');
    newTaskDate = document.getElementById('newTaskDate');
    taskListSelect = document.getElementById('taskListSelect');
    addTaskButton = document.getElementById('addTask');
    saveTaskButton = document.getElementById('saveTask');
    cancelTaskButton = document.getElementById('cancelTask');
    loginPrompt = document.getElementById('loginPrompt');
    loginButton = document.getElementById('loginButton');
    editTaskForm = document.getElementById('editTaskForm');
    editTaskTitle = document.getElementById('editTaskTitle');
    editTaskNotes = document.getElementById('editTaskNotes');
    editTaskDate = document.getElementById('editTaskDate');
    updateTaskButton = document.getElementById('updateTask');
    cancelEditButton = document.getElementById('cancelEdit');
    clearCompletedButton = document.getElementById('clearCompleted');
    configButton = document.getElementById('configButton');
    configMenu = document.getElementById('configMenu');
    listSelection = document.getElementById('listSelection');
    saveConfigButton = document.getElementById('saveConfig');
    closeConfigButton = document.getElementById('closeConfig');
    selectAllButton = document.getElementById('selectAllLists');

    // Initialize new list form elements
    addListButton = document.getElementById('addListButton');
    newListForm = document.getElementById('newListForm');
    newListTitle = document.getElementById('newListTitle');
    saveNewList = document.getElementById('saveNewList');
    cancelNewList = document.getElementById('cancelNewList');

    if (!loginPrompt || !loginButton) {
        console.error('Critical elements missing');
        return false;
    }

    return true;
}

function initializeEventListeners() {
    console.log('Initializing event listeners');

    // Login button click handler
    document.getElementById('loginButton')?.addEventListener('click', handleLogin);

    // Config menu event listeners
    configButton?.addEventListener('click', () => {
        configMenu.classList.remove('hidden');
        loadTaskListsForConfig();
    });

    closeConfigButton?.addEventListener('click', () => {
        configMenu.classList.add('hidden');
    });

    selectAllButton?.addEventListener('click', handleSelectAll);

    saveConfigButton?.addEventListener('click', async () => {
        const checkboxes = listSelection.querySelectorAll('input[type="checkbox"]');
        selectedLists = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        await saveSelectedLists();
        configMenu.classList.add('hidden');
        await loadAllTasks();
    });

    // Task form event listeners
    addTaskButton?.addEventListener('click', async () => {
        newTaskForm.classList.remove('hidden');
        await populateListSelector();
        newTaskTitle.focus();
    });

    cancelTaskButton?.addEventListener('click', () => {
        newTaskForm.classList.add('hidden');
        clearNewTaskForm();
    });

    // Edit form event listeners
    cancelEditButton?.addEventListener('click', () => {
        editTaskForm.classList.add('hidden');
        currentEditingTaskId = null;
        currentTaskList = selectedLists[0];
    });

    updateTaskButton?.addEventListener('click', async () => {
        if (!currentEditingTaskId) return;
        
        const taskElement = document.querySelector(`[data-task-id="${currentEditingTaskId}"]`);
        if (!taskElement) return;
        
        const listId = taskElement.dataset.listId;
        const title = editTaskTitle.value.trim();
        if (!title) return;

        try {
            const taskData = {
                title: title,
                notes: editTaskNotes.value || '',
                due: editTaskDate.value ? new Date(editTaskDate.value).toISOString() : null
            };

            const response = await fetch(
                `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${currentEditingTaskId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(taskData),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Hide the edit form
            editTaskForm.classList.add('hidden');
            currentEditingTaskId = null;

            // Refresh the tasks display
            await loadAllTasks();
        } catch (error) {
            console.error('Error updating task:', error);
            alert('Failed to update task. Please try again.');
        }
    });

    // Clear completed button
    clearCompletedButton?.addEventListener('click', async () => {
        try {
            // Clear completed tasks from all selected lists
            for (const listId of selectedLists) {
                const response = await fetch(
                    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/clear`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    }
                );
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            
            // Refresh all tasks after clearing
            await loadAllTasks();
        } catch (error) {
            console.error('Error clearing completed tasks:', error);
        }
    });

    // Save task button
    saveTaskButton?.addEventListener('click', async () => {
        const title = newTaskTitle.value.trim();
        if (!title || saveTaskButton.disabled) return;

        try {
            saveTaskButton.disabled = true;
            const selectedListId = taskListSelect.value;
            const date = newTaskDate.value;
            let dueDate = null;
            
            if (date) {
                dueDate = `${date}T00:00:00.000Z`;
            }
            
            const response = await fetch(
                `https://tasks.googleapis.com/tasks/v1/lists/${selectedListId}/tasks`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title,
                        notes: newTaskNotes.value,
                        due: dueDate,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            clearNewTaskForm();
            newTaskForm.classList.add('hidden');
            await loadAllTasks();
        } catch (error) {
            console.error('Error creating task:', error);
        } finally {
            saveTaskButton.disabled = false;
        }
    });

    // New list form event listeners
    addListButton?.addEventListener('click', () => {
        newListForm.classList.remove('hidden');
        newListTitle.focus();
    });

    cancelNewList?.addEventListener('click', () => {
        newListForm.classList.add('hidden');
        newListTitle.value = '';
    });

    saveNewList?.addEventListener('click', async () => {
        const title = newListTitle.value.trim();
        if (!title || saveNewList.disabled) return;

        try {
            saveNewList.disabled = true;
            const response = await fetch(
                'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ title }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const newList = await response.json();
            
            // Only add to selectedLists if it's not already there
            if (!selectedLists.includes(newList.id)) {
                selectedLists.push(newList.id);
                await saveSelectedLists();
            }

            // Clear and hide the form
            newListTitle.value = '';
            newListForm.classList.add('hidden');

            // Refresh the lists display
            await loadTaskListsForConfig();
        } catch (error) {
            console.error('Error creating new list:', error);
        } finally {
            saveNewList.disabled = false;
        }
    });

    // Add delete task button handler
    const deleteTaskButton = document.querySelector('.delete-task-button');
    if (deleteTaskButton) {
        // Remove any existing event listeners
        deleteTaskButton.replaceWith(deleteTaskButton.cloneNode(true));
        const newDeleteTaskButton = document.querySelector('.delete-task-button');
        
        newDeleteTaskButton.addEventListener('click', () => {
            if (currentEditingTaskId && currentTaskList) {
                const taskElement = document.querySelector(`[data-task-id="${currentEditingTaskId}"]`);
                const taskTitle = taskElement ? taskElement.querySelector('.task-content').textContent : 'this task';
                deleteTask(currentEditingTaskId, currentTaskList, taskTitle);
            }
        });
    }
}

// Load task lists for config menu
async function loadTaskListsForConfig() {
    try {
        if (!listSelection) return;
        listSelection.innerHTML = '';

        const response = await fetch(
            'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Create a Map to store unique lists
        const seenIds = new Set();
        const seenTitles = new Set();
        const uniqueLists = (data.items || []).filter(list => {
            if (seenIds.has(list.id) || seenTitles.has(list.title)) {
                return false;
            }
            seenIds.add(list.id);
            seenTitles.add(list.title);
            return true;
        });
        
        // Sort lists alphabetically
        allLists = uniqueLists.sort((a, b) => a.title.localeCompare(b.title));

        // Clear existing selection and rebuild
        listSelection.innerHTML = '';
        
        // Create a temporary copy of selectedLists for the config menu
        let tempSelectedLists = [...selectedLists];

        allLists.forEach(list => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            listItem.dataset.listId = list.id;

            const leftDiv = document.createElement('div');
            leftDiv.className = 'list-item-left';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `list-${list.id}`;
            checkbox.value = list.id;
            checkbox.checked = tempSelectedLists.includes(list.id);
            
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!tempSelectedLists.includes(list.id)) {
                        tempSelectedLists.push(list.id);
                    }
                } else {
                    tempSelectedLists = tempSelectedLists.filter(id => id !== list.id);
                }
                updateSelectAllButtonState();
            });

            const label = document.createElement('label');
            label.htmlFor = `list-${list.id}`;
            label.textContent = list.title;

            // Add color picker button
            const colorButton = document.createElement('button');
            colorButton.className = 'color-picker-button';
            colorButton.style.backgroundColor = listColors[list.id] || '#1a73e8';
            colorButton.onclick = () => openColorPicker(list.id, listColors[list.id]);

            leftDiv.appendChild(checkbox);
            leftDiv.appendChild(colorButton);
            leftDiv.appendChild(label);
            listItem.appendChild(leftDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'list-item-actions';

            const editButton = document.createElement('button');
            editButton.className = 'edit-list-button';
            editButton.textContent = 'Edit';
            editButton.onclick = async () => {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = list.title;
                label.replaceWith(input);
                input.focus();

                const handleSave = async () => {
                    const newTitle = input.value.trim();
                    if (newTitle && newTitle !== list.title) {
                        try {
                            const response = await fetch(
                                `https://tasks.googleapis.com/tasks/v1/users/@me/lists/${list.id}`,
                                {
                                    method: 'PATCH',
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ title: newTitle }),
                                }
                            );

                            if (response.ok) {
                                list.title = newTitle;
                                label.textContent = newTitle;
                                await loadAllTasks();
                            }
                        } catch (error) {
                            console.error('Error updating list title:', error);
                        }
                    }
                    input.replaceWith(label);
                };

                input.onblur = handleSave;
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        handleSave();
                    } else if (e.key === 'Escape') {
                        input.replaceWith(label);
                    }
                };
            };

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-list-button';
            deleteButton.innerHTML = '&times;';
            deleteButton.title = 'Delete list';
            deleteButton.onclick = () => deleteList(list.id, list.title);

            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            listItem.appendChild(actionsDiv);
            listSelection.appendChild(listItem);
        });

        // Update the Save button handler to use tempSelectedLists
        saveConfigButton.onclick = async () => {
            selectedLists = [...tempSelectedLists];
            await saveSelectedLists();
            configMenu.classList.add('hidden');
            await loadAllTasks();
        };

        updateSelectAllButtonState();
    } catch (error) {
        console.error('Error loading task lists for config:', error);
    }
}

function updateSelectAllButtonState() {
    if (selectAllButton) {
        const checkboxes = listSelection.querySelectorAll('input[type="checkbox"]:not(:disabled)');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        selectAllButton.textContent = allChecked ? 'Unselect All' : 'Select All';
    }
}

function handleSelectAll() {
    const checkboxes = listSelection.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        // Manually trigger the change event
        const event = new Event('change', { bubbles: true });
        cb.dispatchEvent(event);
    });

    updateSelectAllButtonState();
}

// Check for stored token on startup
async function checkStoredToken() {
    try {
        const result = await chrome.storage.local.get(['accessToken']);
        if (result.accessToken) {
            console.log('Found stored token');
            accessToken = result.accessToken;
            hideLoginPrompt();
            await loadAllTasks();
            return true;
        }
    } catch (error) {
        console.error('Error checking stored token:', error);
    }
    return false;
}

// Store token with expiry (1 hour from now)
async function storeToken(token) {
    try {
        await chrome.storage.local.set({
            accessToken: token
        });
        console.log('Token stored successfully');
    } catch (error) {
        console.error('Error storing token:', error);
    }
}

// Ensure the page is visible immediately
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    document.body.style.display = 'block';
    if (!window.isInitialized) {
        initializeExtension();
        window.isInitialized = true;
    }
});

// Also try to initialize immediately for Edge
if (isEdge && !window.isInitialized) {
    console.log('Immediate initialization for Edge');
    document.body.style.display = 'block';
    initializeExtension();
    window.isInitialized = true;
}

function formatDateTime(due) {
    if (!due) return '';
    
    // Parse the UTC date and convert to local time
    const utcDate = new Date(due);
    const localDate = new Date(utcDate.getTime() + (utcDate.getTimezoneOffset() * 60000));
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Compare using local dates
    const taskDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
    
    // Compare timestamps at midnight
    if (taskDate.getTime() === today.getTime()) {
        return 'Today';
    } else if (taskDate.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    } else {
        return localDate.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
    }
}

async function checkLoginState() {
    try {
        // Try to get the token silently first
        if (isEdge) {
            // For Edge, check stored token
            const result = await chrome.storage.local.get(['accessToken']);
            if (result.accessToken) {
                accessToken = result.accessToken;
                hideLoginPrompt();
                await loadAllTasks();
                return true;
            }
        } else {
            // For Chrome, use identity API
            const token = await new Promise((resolve) => {
                chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
                    resolve(token);
                });
            });
            if (token) {
                accessToken = token;
                hideLoginPrompt();
                await loadAllTasks();
                return true;
            }
        }
        
        // If we don't have a token, show the login prompt
        showLoginPrompt();
        return false;
    } catch (error) {
        console.error('Error checking login state:', error);
        showLoginPrompt();
        return false;
    }
}

function showLoginPrompt() {
    if (loginPrompt) {
        loginPrompt.classList.remove('hidden');
    }
}

function hideLoginPrompt() {
    if (loginPrompt) {
        loginPrompt.classList.add('hidden');
    }
}

async function handleLogin() {
    try {
        if (isEdge) {
            console.log('Using Edge authentication flow');
            const redirectURL = chrome.identity.getRedirectURL();
            console.log('Redirect URL:', redirectURL);

            const authURL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectURL)}&scope=${encodeURIComponent(SCOPES)}`;

            const responseUrl = await chrome.identity.launchWebAuthFlow({
                url: authURL,
                interactive: true
            });

            if (responseUrl) {
                const token = new URLSearchParams(responseUrl.split('#')[1]).get('access_token');
                if (token) {
                    console.log('Successfully obtained token in Edge');
                    accessToken = token;
                    await chrome.storage.local.set({ accessToken: token });
                    // Clear any existing list selection to force selecting all lists
                    await chrome.storage.local.remove(['selectedLists']);
                    loginPrompt.style.display = 'none';
                    document.querySelector('.container').classList.remove('hidden');
                    await loadSelectedLists();
                    await loadAllTasks();
                }
            }
        } else {
            console.log('Using Chrome authentication flow');
            // Clear any existing tokens and selections
            await chrome.storage.local.clear();
            if (accessToken) {
                chrome.identity.removeCachedAuthToken({ 'token': accessToken });
            }
            
            // Get a fresh token
            chrome.identity.getAuthToken({ 'interactive': true }, async function(token) {
                if (chrome.runtime.lastError) {
                    console.error('Chrome auth error:', chrome.runtime.lastError);
                    return;
                }
                console.log('Successfully obtained token in Chrome');
                accessToken = token;
                loginPrompt.style.display = 'none';
                document.querySelector('.container').classList.remove('hidden');
                await loadSelectedLists();
                await loadAllTasks();
            });
        }
    } catch (error) {
        console.error('Error during login:', error);
    }
}

// API Functions
async function loadAllTasks() {
    try {
        // Validate token before proceeding
        if (accessToken && !(await validateToken(accessToken))) {
            console.log('Token expired during loadAllTasks, showing login');
            if (!isEdge) {
                await chrome.storage.local.clear();
                chrome.identity.removeCachedAuthToken({ 'token': accessToken });
            } else {
                await chrome.storage.local.remove(['accessToken']);
            }
            accessToken = null;
            loginPrompt.style.display = 'flex';
            document.querySelector('.container').classList.add('hidden');
            return;
        }

        if (!tasksContainer) return;
        
        const tempContainer = document.createElement('div');
        tempContainer.className = 'tasks';

        if (!selectedLists || selectedLists.length === 0) {
            const noListsMessage = document.createElement('div');
            noListsMessage.className = 'no-lists-message';
            noListsMessage.textContent = 'No lists selected. Select lists in Settings to view tasks.';
            tempContainer.appendChild(noListsMessage);
            tasksContainer.innerHTML = '';
            tasksContainer.appendChild(tempContainer);
            return;
        }

        const listPromises = selectedLists.map(async listId => {
            try {
                const [tasksResponse, listResponse] = await Promise.all([
                    fetch(
                        `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Cache-Control': 'no-cache'
                            },
                        }
                    ),
                    fetch(
                        `https://tasks.googleapis.com/tasks/v1/users/@me/lists/${listId}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Cache-Control': 'no-cache'
                            },
                        }
                    )
                ]);

                if (!tasksResponse.ok || !listResponse.ok) return null;

                const [tasksData, listData] = await Promise.all([
                    tasksResponse.json(),
                    listResponse.json()
                ]);

                if (!tasksData.items) return null;

                return {
                    listId,
                    listTitle: listData.title,
                    tasks: tasksData.items
                };
            } catch (error) {
                console.error('Error loading tasks for list:', error);
                return null;
            }
        });

        const results = (await Promise.all(listPromises))
            .filter(result => result !== null)
            .sort((a, b) => a.listTitle.localeCompare(b.listTitle));

        if (results.length === 0) {
            const noTasksMessage = document.createElement('div');
            noTasksMessage.className = 'no-lists-message';
            noTasksMessage.textContent = 'No tasks found in selected lists.';
            tempContainer.appendChild(noTasksMessage);
            tasksContainer.innerHTML = '';
            tasksContainer.appendChild(tempContainer);
            return;
        }

        results.forEach(({ listId, listTitle, tasks }) => {
            if (tasks && tasks.length > 0) {
                const listSection = document.createElement('div');
                listSection.className = 'task-list-section';

                const listHeader = document.createElement('h3');
                listHeader.className = 'list-header';
                listHeader.style.color = listColors[listId] || '#1a73e8';
                
                const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                arrow.setAttribute('class', 'list-header-arrow');
                arrow.setAttribute('viewBox', '0 0 24 24');
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute('d', 'M7 10l5 5 5-5z');
                arrow.appendChild(path);
                
                listHeader.appendChild(arrow);
                listHeader.appendChild(document.createTextNode(listTitle));

                // Add colored line under header
                const headerLine = document.createElement('div');
                headerLine.className = 'header-line';
                headerLine.style.backgroundColor = listColors[listId] || '#1a73e8';
                listHeader.appendChild(headerLine);
                
                listHeader.addEventListener('click', () => {
                    listHeader.classList.toggle('collapsed');
                    taskContent.classList.toggle('collapsed');
                });
                
                listSection.appendChild(listHeader);

                const taskContent = document.createElement('div');
                taskContent.className = 'task-list-content';

                // Use Set for faster duplicate checking
                const uniqueTaskIds = new Set();
                tasks.sort(compareTasks).forEach(task => {
                    if (!uniqueTaskIds.has(task.id)) {
                        uniqueTaskIds.add(task.id);
                        const taskElement = createTaskElement({task, listId});
                        taskContent.appendChild(taskElement);
                    }
                });

                listSection.appendChild(taskContent);
                tempContainer.appendChild(listSection);
            }
        });

        tasksContainer.innerHTML = '';
        tasksContainer.appendChild(tempContainer);

    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Fix the task sorting function
function compareTasks(taskA, taskB) {
    // First sort by completion status
    if (taskA.status === 'completed' && taskB.status !== 'completed') return 1;
    if (taskA.status !== 'completed' && taskB.status === 'completed') return -1;
    if (taskA.status === 'completed' && taskB.status === 'completed') return 0;

    // Then sort by due date
    if (!taskA.due && !taskB.due) return 0;
    if (!taskA.due) return 1;
    if (!taskB.due) return -1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dateA = new Date(taskA.due);
    const dateB = new Date(taskB.due);
    dateA.setHours(0, 0, 0, 0);
    dateB.setHours(0, 0, 0, 0);

    return dateA.getTime() - dateB.getTime();
}

async function handleTaskStatusChange(taskId, listId, isCompleted) {
    try {
        const status = isCompleted ? 'completed' : 'needsAction';
        const response = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}?timestamp=${Date.now()}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                body: JSON.stringify({ status }),
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Update the task element's appearance without a full refresh
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            if (isCompleted) {
                taskElement.classList.add('completed');
            } else {
                taskElement.classList.remove('completed');
            }

            // Move the task to the correct position
            const listContent = taskElement.parentElement;
            const tasks = Array.from(listContent.children);
            
            // Sort tasks by completion status
            tasks.sort((a, b) => {
                const aCompleted = a.classList.contains('completed');
                const bCompleted = b.classList.contains('completed');
                
                if (aCompleted && !bCompleted) return 1;
                if (!aCompleted && bCompleted) return -1;
                
                // For uncompleted tasks, put recently uncompleted tasks at the top
                if (!aCompleted && !bCompleted && a.dataset.taskId === taskId) return -1;
                
                return 0;
            });

            // Apply the new order with smooth animation
            tasks.forEach((task, index) => {
                task.style.transition = 'transform 0.3s ease';
                const currentIndex = Array.from(listContent.children).indexOf(task);
                if (currentIndex !== index) {
                    listContent.insertBefore(task, listContent.children[index]);
                }
            });
        }
    } catch (error) {
        console.error('Error updating task status:', error);
        throw error;
    }
}

async function createTask(title, notes = '', dueDate = null) {
    console.log('Creating task:', { title, notes, dueDate });
    const response = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${currentTaskList}/tasks`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                notes,
                due: dueDate
            }),
        }
    );
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

function getTimeFromNotes(notes) {
    if (!notes) return null;
    const match = notes.match(/__TIME__(.*?)__/);
    return match ? match[1] : null;
}

async function updateTask(taskId, updates) {
    console.log('Updating task:', { taskId, updates });
    
    // If there's a due date, ensure it's in the correct format
    if (updates.due && typeof updates.due === 'string') {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const dateTimeStr = `${updates.due}`;
        const date = new Date(dateTimeStr);
        updates.due = date.toISOString();
    }
    
    const response = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${currentTaskList}/tasks/${taskId}`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        }
    );
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// UI Functions
function renderTaskLists(taskLists) {
    if (!taskListsContainer) return;
    
    const html = taskLists.map(list => `
        <div class="task-list" data-id="${list.id}">
            ${list.title}
        </div>
    `).join('');
    taskListsContainer.innerHTML = html;

    // Add click listeners
    document.querySelectorAll('.task-list').forEach(element => {
        element.addEventListener('click', async () => {
            currentTaskList = element.dataset.id;
            await loadAllTasks();
        });
    });
}

function renderTasks(tasks) {
    if (!tasksContainer) return;

    const html = tasks.map(task => {
        const dueDate = task.due ? formatDateTime(task.due) : '';
        console.log('Rendering task:', {
            title: task.title,
            due: task.due,
            formattedDue: dueDate
        });
        
        return `
            <div class="task-item" data-id="${task.id}">
                <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
                <div class="task-content">
                    <div class="task-title ${task.status === 'completed' ? 'completed' : ''}">${task.title}</div>
                    ${task.notes ? `<div class="task-notes">${task.notes}</div>` : ''}
                    ${dueDate ? `<div class="task-due-date">${dueDate}</div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="edit-button" onclick="editTask('${task.id}')">Edit</button>
                </div>
            </div>
        `;
    }).join('');
    
    tasksContainer.innerHTML = html || '<p>No tasks found</p>';

    // Add checkbox listeners
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const taskId = e.target.parentElement.dataset.id;
            const status = e.target.checked ? 'completed' : 'needsAction';
            await updateTask(taskId, { status });
            await loadAllTasks();
        });
    });
}

function clearNewTaskForm() {
    if (newTaskTitle) newTaskTitle.value = '';
    if (newTaskNotes) newTaskNotes.value = '';
    if (newTaskDate) newTaskDate.value = '';
}

async function editTask(taskId) {
   try {
        const response = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${currentTaskList}/tasks/${taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const task = await response.json();
        
        currentEditingTaskId = taskId;
        editTaskTitle.value = task.title || '';
        editTaskNotes.value = task.notes || '';
        
        if (task.due) {
            const date = new Date(task.due);
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // Format date for input
            const localDate = date.toLocaleDateString('en-CA', { // en-CA gives YYYY-MM-DD format
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            editTaskDate.value = localDate;
        } else {
            editTaskDate.value = '';
        }
        
        editTaskForm.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading task for edit:', error);
    }
}

// Add function to populate list selector
async function populateListSelector() {
    if (!taskListSelect) return;
    
    try {
        const response = await fetch(
            'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.items) {
            taskListSelect.innerHTML = data.items
                .filter(list => selectedLists.includes(list.id))
                .map(list => `
                    <option value="${list.id}">${list.title}</option>
                `).join('');
            
            // Select the first list by default
            if (taskListSelect.options.length > 0) {
                taskListSelect.value = taskListSelect.options[0].value;
            }
        }
    } catch (error) {
        console.error('Error populating list selector:', error);
    }
}

// Sort tasks by completion status and due date
function sortTasks(tasks) {
    return tasks.sort((a, b) => {
        // First sort by completion status
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        
        // If both tasks have the same completion status, sort by due date
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due) - new Date(b.due);
    });
}

function createTaskElement(taskData) {
    const task = taskData.task || taskData;
    const listId = taskData.listId;
    const listColor = listColors[listId] || '#1a73e8';

    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    if (task.status === 'completed') {
        taskElement.classList.add('completed');
    }
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.listId = listId;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.status === 'completed';
    checkbox.style.color = listColor;
    checkbox.addEventListener('change', () => handleTaskStatusChange(task.id, listId, checkbox.checked));

    const mainContent = document.createElement('div');
    mainContent.className = 'task-main-content';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'task-content-wrapper';

    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';
    taskContent.textContent = task.title;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'task-actions';

    const editButton = document.createElement('button');
    editButton.className = 'edit-task-button';
    editButton.textContent = 'Edit';
    editButton.onclick = (e) => {
        e.stopPropagation();
        loadTaskForEdit(task.id, listId);
    };
    actionsDiv.appendChild(editButton);

    contentWrapper.appendChild(taskContent);
    contentWrapper.appendChild(actionsDiv);
    mainContent.appendChild(contentWrapper);

    if (task.notes || task.due) {
        if (task.notes) {
            const notesElement = document.createElement('div');
            notesElement.className = 'task-notes';
            
            // Check if notes contain URLs
            const hasUrls = /(https?:\/\/[^\s]+)/.test(task.notes);
            if (hasUrls) {
                notesElement.classList.add('contains-url');
                // Replace URLs with colored links, preserving line breaks
                const notesText = task.notes.replace(/(https?:\/\/[^\s]+)/g, 
                    (url) => `<a href="${url}" target="_blank" style="color: ${listColor}">${url}</a>`);
                notesElement.innerHTML = notesText.replace(/\n/g, '<br>');
            } else {
                notesElement.textContent = task.notes;
            }

            // Check if content needs fade effect (more than 3 lines)
            requestAnimationFrame(() => {
                const lineHeight = parseInt(window.getComputedStyle(notesElement).lineHeight);
                const maxHeight = lineHeight * 3;
                if (notesElement.scrollHeight > maxHeight) {
                    notesElement.classList.add('has-overflow');
                }
            });

            // Add click handler for expansion
            notesElement.addEventListener('click', (e) => {
                if (e.target.tagName !== 'A') {  // Don't expand when clicking links
                    notesElement.classList.toggle('expanded');
                }
            });
            
            mainContent.appendChild(notesElement);
        }

        if (task.due) {
            const dueDate = document.createElement('div');
            dueDate.className = 'task-date';
            dueDate.textContent = formatDateTime(task.due);
            dueDate.style.color = listColor;
            mainContent.appendChild(dueDate);
        }
    }

    taskElement.appendChild(checkbox);
    taskElement.appendChild(mainContent);

    return taskElement;
}

function createListElement(list, checked = false) {
  const listItem = document.createElement('div');
  listItem.className = 'list-item';
  listItem.dataset.listId = list.id;

  const leftSection = document.createElement('div');
  leftSection.className = 'list-item-left';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.className = 'list-checkbox';

  const listTitle = document.createElement('span');
  listTitle.textContent = list.title;

  leftSection.appendChild(checkbox);
  leftSection.appendChild(listTitle);

  const deleteButton = document.createElement('button');
  deleteButton.textContent = '×';
  deleteButton.className = 'delete-button';
  deleteButton.title = 'Delete list';
  deleteButton.onclick = async (e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this list? All tasks in this list will be deleted.')) {
      try {
        await gapi.client.tasks.tasklists.delete({
          tasklist: list.id
        });
        listItem.remove();
      } catch (error) {
        console.error('Error deleting list:', error);
      }
    }
  };

  listItem.appendChild(leftSection);
  listItem.appendChild(deleteButton);

  return listItem;
}

// Logout handling
document.getElementById('logoutButton')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to sign out?')) {
        try {
            if (isEdge) {
                // For Edge, clear stored token
                await chrome.storage.local.remove(['accessToken']);
                if (accessToken) {
                    // Revoke the token
                    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${accessToken}`, {
                        method: 'GET'
                    });
                }
            } else {
                // For Chrome, we need to be more thorough
                // First clear all storage
                await chrome.storage.local.clear();

                // Remove the current token if we have it
                if (accessToken) {
                    await new Promise((resolve) => {
                        chrome.identity.removeCachedAuthToken({ 'token': accessToken }, resolve);
                    });
                }

                // Get and remove any other tokens that might exist
                await new Promise((resolve) => {
                    chrome.identity.getAuthToken({ 'interactive': false }, async function(token) {
                        if (token) {
                            // Remove this token
                            await new Promise(resolve2 => {
                                chrome.identity.removeCachedAuthToken({ 'token': token }, resolve2);
                            });
                            // Also revoke it from Google
                            await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
                                method: 'GET'
                            });
                        }
                        resolve();
                    });
                });
            }
            
            // Reset all state variables
            accessToken = null;
            selectedLists = [];
            allLists = [];
            currentTaskList = null;
            
            // Clear the tasks container
            const tasksContainer = document.getElementById('tasks');
            if (tasksContainer) {
                tasksContainer.innerHTML = '';
            }

            // Reset UI state
            document.querySelector('.container').classList.add('hidden');
            loginPrompt.style.display = 'flex';
            
            // Hide any open modals
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                if (modal.id !== 'loginPrompt') {
                    modal.classList.add('hidden');
                }
            });

            // For Chrome, do one final check and cleanup after a short delay
            if (!isEdge) {
                setTimeout(async () => {
                    try {
                        await new Promise((resolve) => {
                            chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
                                if (token) {
                                    chrome.identity.removeCachedAuthToken({ 'token': token }, resolve);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    } catch (error) {
                        console.error('Final cleanup error:', error);
                    }
                }, 500);
            }
            
        } catch (error) {
            console.error('Error during sign out:', error);
            // Even if there's an error, try to reset the UI state
            document.querySelector('.container').classList.add('hidden');
            loginPrompt.style.display = 'flex';
        }
    }
});

// Load selected lists from storage
async function loadSelectedLists() {
    try {
        const response = await fetch(
            'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        allLists = data.items || [];

        // Load previously selected lists from storage
        const storage = await chrome.storage.local.get(['selectedLists']);
        
        // If no lists are selected or after fresh login, select all lists
        if (!storage.selectedLists || storage.selectedLists.length === 0) {
            selectedLists = allLists.map(list => list.id);
            // Save the selection
            await chrome.storage.local.set({ selectedLists });
        } else {
            // Filter out any lists that no longer exist
            selectedLists = storage.selectedLists.filter(id => 
                allLists.some(list => list.id === id)
            );
            // If all selected lists were deleted, select all available lists
            if (selectedLists.length === 0) {
                selectedLists = allLists.map(list => list.id);
                await chrome.storage.local.set({ selectedLists });
            }
        }

        return selectedLists;
    } catch (error) {
        console.error('Error in loadSelectedLists:', error);
        return [];
    }
}

// Save selected lists to storage
async function saveSelectedLists() {
    try {
        await chrome.storage.local.set({ 
            selectedLists,
            currentTaskList: selectedLists.length > 0 ? selectedLists[0] : null
        });
        console.log('Saved selected lists:', selectedLists);
    } catch (error) {
        console.error('Error saving selected lists:', error);
    }
}

// Fix the edit task functionality
async function handleEditTask(taskId, listId) {
    try {
        currentEditingTaskId = taskId;
        currentTaskList = listId;
        
        const response = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}?timestamp=${Date.now()}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const task = await response.json();
        
        editTaskTitle.value = task.title || '';
        editTaskNotes.value = task.notes || '';
        if (task.due) {
            const dueDate = new Date(task.due);
            editTaskDate.value = dueDate.toISOString().split('T')[0];
        } else {
            editTaskDate.value = '';
        }
        
        // Show the edit form
        editTaskForm.classList.remove('hidden');
        
        // Re-initialize event listeners to ensure clean state
        initializeEventListeners();
    } catch (error) {
        console.error('Error loading task for edit:', error);
        alert('Failed to load task for editing. Please try again.');
    }
}

// Add cancel edit button handler
document.getElementById('cancelEdit')?.addEventListener('click', () => {
    editTaskForm.classList.add('hidden');
    currentEditingTaskId = null;
});

async function loadInitialLists() {
    try {
        const response = await fetch(
            'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Ensure uniqueness in allLists
        const seenIds = new Set();
        allLists = (data.items || []).filter(list => {
            if (seenIds.has(list.id)) {
                return false;
            }
            seenIds.add(list.id);
            return true;
        });

        // Load previously selected lists from storage
        const storage = await chrome.storage.local.get(['selectedLists', 'currentTaskList']);
        
        if (!storage.selectedLists || storage.selectedLists.length === 0) {
            // For first login, only select the first list by default
            selectedLists = allLists.length > 0 ? [allLists[0].id] : [];
            currentTaskList = allLists[0]?.id || '@default';
            
            await chrome.storage.local.set({
                selectedLists,
                currentTaskList
            });
        } else {
            // Filter out any duplicate IDs from stored selectedLists
            selectedLists = [...new Set(storage.selectedLists)];
            // Ensure all selectedLists actually exist in allLists
            selectedLists = selectedLists.filter(id => allLists.some(list => list.id === id));
            // If no valid lists remain, select the first list
            if (selectedLists.length === 0 && allLists.length > 0) {
                selectedLists = [allLists[0].id];
            }
            currentTaskList = storage.currentTaskList || selectedLists[0] || '@default';
        }

        await loadAllTasks();
        await loadTaskListsForConfig();
        
    } catch (error) {
        console.error('Error loading initial lists:', error);
    }
}

async function deleteTask(taskId, listId, taskTitle) {
    if (!confirm(`Are you sure you want to delete "${taskTitle}"?`)) {
        return;
    }

    try {
        const response = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Close the edit form
        editTaskForm.classList.add('hidden');
        
        // Remove the task element with animation
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            taskElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            taskElement.style.opacity = '0';
            taskElement.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                taskElement.remove();
                // If this was the last task in the list, refresh to show "No tasks" message
                const listContent = document.querySelector('.task-list-content');
                if (listContent && !listContent.children.length) {
                    loadAllTasks();
                }
            }, 300);
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task. Please try again.');
    }
}

// Add this function to create the color picker modal
function openColorPicker(listId, currentColor) {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay color-palette-overlay';
    modalOverlay.style.display = 'flex';

    const paletteContainer = document.createElement('div');
    paletteContainer.className = 'color-palette-container';

    COLOR_PALETTE.forEach(color => {
        const colorOption = document.createElement('button');
        colorOption.className = 'color-option';
        
        if (color === 'custom') {
            colorOption.classList.add('custom');
            colorOption.onclick = () => {
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = currentColor || '#1a73e8';

                // Apply color and close when a color is selected
                colorInput.addEventListener('change', async (e) => {
                    const newColor = e.target.value;
                    listColors[listId] = newColor;
                    await chrome.storage.local.set({ listColors });
                    
                    const colorButton = document.querySelector(`[data-list-id="${listId}"] .color-picker-button`);
                    if (colorButton) {
                        colorButton.style.backgroundColor = newColor;
                    }
                    
                    modalOverlay.remove();
                });

                colorInput.click(); // Open the native color picker immediately
            };
        } else {
            colorOption.style.backgroundColor = color;
            if (color === currentColor) {
                colorOption.classList.add('selected');
            }
            colorOption.onclick = async () => {
                listColors[listId] = color;
                await chrome.storage.local.set({ listColors });
                
                const colorButton = document.querySelector(`[data-list-id="${listId}"] .color-picker-button`);
                if (colorButton) {
                    colorButton.style.backgroundColor = color;
                }
                
                modalOverlay.remove();
            };
        }
        paletteContainer.appendChild(colorOption);
    });

    modalOverlay.appendChild(paletteContainer);
    document.body.appendChild(modalOverlay);

    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
}

// Update displayTaskList to apply colors
function displayTaskList(listId, tasks, container) {
    const listColor = listColors[listId] || '#1a73e8';
    const listElement = document.createElement('div');
    listElement.className = 'task-list';

    // Create list header with color
    const listHeader = document.createElement('div');
    listHeader.className = 'list-header';
    listHeader.style.borderBottom = `2px solid ${listColor}`;

    const listTitle = document.createElement('h2');
    listTitle.textContent = allLists.find(l => l.id === listId)?.title || 'Tasks';
    listTitle.style.color = listColor;
    
    listHeader.appendChild(listTitle);
    listElement.appendChild(listHeader);

    // Add tasks
    tasks.forEach(task => {
        const taskElement = createTaskElement(task, listId);
        listElement.appendChild(taskElement);
    });

    return listElement;
}

async function loadTaskForEdit(taskId, listId) {
    try {
        const response = await fetch(
            `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const task = await response.json();
        
        currentEditingTaskId = taskId;
        editTaskTitle.value = task.title || '';
        editTaskNotes.value = task.notes || '';
        
        if (task.due) {
            const date = new Date(task.due);
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // Format date for input
            const localDate = date.toLocaleDateString('en-CA', { // en-CA gives YYYY-MM-DD format
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            editTaskDate.value = localDate;
        } else {
            editTaskDate.value = '';
        }
        
        editTaskForm.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading task for edit:', error);
    }
}



