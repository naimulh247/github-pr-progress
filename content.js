// Load saved position and state
const savedState = JSON.parse(localStorage.getItem('prProgressState') || '{}');

function findChecklistGroups() {
    // Find all task list items
    const allTaskItems = Array.from(document.querySelectorAll('.task-list-item'));
    if (allTaskItems.length === 0) return [];

    const groups = [];
    let currentGroup = null;

    // Get the previous header or text node
    function getPreviousHeader(element) {
        let previous = element;
        while (previous = previous.previousElementSibling) {
            // Check if it's a header or a paragraph
            if (previous.matches('h1, h2, h3, h4, h5, h6, p')) {
                return previous.textContent.trim();
            }
        }
        return 'Uncategorized';
    }

    // Group consecutive task items
    allTaskItems.forEach((item, index) => {
        // If this is the first item or there's a gap from the previous item
        if (index === 0 || !item.previousElementSibling?.matches('.task-list-item')) {
            // Start a new group
            if (currentGroup) {
                groups.push(currentGroup);
            }
            
            const groupName = getPreviousHeader(item.closest('.contains-task-list'));
            currentGroup = {
                name: groupName,
                items: [item]
            };
        } else {
            // Add to current group
            currentGroup.items.push(item);
        }
    });

    // Add the last group
    if (currentGroup) {
        groups.push(currentGroup);
    }

    return groups;
}

function createProgressOverlay() {
    // Remove existing overlay if any
    const existingOverlay = document.querySelector('.pr-progress-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    const groups = findChecklistGroups();
    if (groups.length === 0) return;

    // Create overlay elements
    const overlay = document.createElement('div');
    overlay.className = 'pr-progress-overlay';
    overlay.dataset.persist = 'true';

    // Calculate total progress
    const totalStats = groups.reduce((acc, group) => {
        const completed = group.items.filter(item => 
            item.querySelector('.task-list-item-checkbox').checked
        ).length;
        return {
            total: acc.total + group.items.length,
            completed: acc.completed + completed
        };
    }, { total: 0, completed: 0 });

    const totalPercentage = Math.round((totalStats.completed / totalStats.total) * 100);

    // Create HTML content with header controls
    let content = `
        <div class="pr-progress-header">
            <div class="pr-progress-title">📊 PR Progress</div>
            <div class="pr-progress-controls">
                <button class="pr-progress-button theme-toggle" title="Toggle theme">
                    ${getThemeIcon(document.documentElement.getAttribute('data-color-mode') || 'light')}
                </button>
                <button class="pr-progress-button" id="toggleCollapse" title="Toggle collapse">
                    ${savedState.collapsed ? '▼' : '▲'}
                </button>
                <button class="pr-progress-button" id="closeProgress" title="Close">✕</button>
            </div>
        </div>
        <div class="pr-progress-summary">
            <div class="pr-progress-bar">
                <div class="pr-progress-fill" style="width: ${totalPercentage}%"></div>
            </div>
            <div class="pr-progress-stats">
                <span>✅ ${totalStats.completed}/${totalStats.total} total</span>
                <span>${totalPercentage}% complete</span>
            </div>
        </div>
        <div class="pr-progress-content ${savedState.collapsed ? 'collapsed' : ''}">
    `;

    // Add individual group progress
    groups.forEach(group => {
        const completedTasks = group.items.filter(item => 
            item.querySelector('.task-list-item-checkbox').checked
        ).length;
        const groupPercentage = Math.round((completedTasks / group.items.length) * 100);
        
        content += `
            <div class="pr-progress-group">
                <div class="pr-progress-group-title">${group.name}</div>
                <div class="pr-progress-bar">
                    <div class="pr-progress-fill" style="width: ${groupPercentage}%"></div>
                </div>
                <div class="pr-progress-stats">
                    <span>${completedTasks}/${group.items.length}</span>
                    <span>${groupPercentage}%</span>
                </div>
            </div>
        `;
    });

    content += '</div>'; // Close pr-progress-content
    overlay.innerHTML = content;

    // Restore position
    if (savedState.position) {
        overlay.style.transform = `translate3d(${savedState.position.x}px, ${savedState.position.y}px, 0)`;
    }

    // Add event listeners
    overlay.querySelector('.theme-toggle').addEventListener('click', cycleTheme);
    
    overlay.querySelector('#toggleCollapse').addEventListener('click', () => {
        const content = overlay.querySelector('.pr-progress-content');
        const button = overlay.querySelector('#toggleCollapse');
        const isCollapsed = content.classList.toggle('collapsed');
        button.textContent = isCollapsed ? '▼' : '▲';
        savedState.collapsed = isCollapsed;
        localStorage.setItem('prProgressState', JSON.stringify(savedState));
    });

    overlay.querySelector('#closeProgress').addEventListener('click', () => {
        overlay.remove();
    });

    // Drag functionality
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = savedState.position?.x || 0;
    let yOffset = savedState.position?.y || 0;

    const header = overlay.querySelector('.pr-progress-header');
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.closest('.pr-progress-controls')) return;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            setTranslate(currentX, currentY, overlay);
            
            // Save position
            savedState.position = { x: currentX, y: currentY };
            localStorage.setItem('prProgressState', JSON.stringify(savedState));
        }
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    function dragEnd() {
        isDragging = false;
    }

    // Add to page
    document.body.appendChild(overlay);
}

// Update on checkbox changes
document.addEventListener('change', (e) => {
    if (e.target.matches('.task-list-item-checkbox')) {
        createProgressOverlay();
        updateMergeButtonState();
    }
});

// Update merge button state
function updateMergeButtonState() {
    const groups = findChecklistGroups();
    if (groups.length === 0) return;

    // Calculate total progress
    const totalStats = groups.reduce((acc, group) => {
        const completed = group.items.filter(item => 
            item.querySelector('.task-list-item-checkbox').checked
        ).length;
        return {
            total: acc.total + group.items.length,
            completed: acc.completed + completed
        };
    }, { total: 0, completed: 0 });

    const totalPercentage = Math.round((totalStats.completed / totalStats.total) * 100);
    
    // Find all merge buttons
    const mergeButtons = document.querySelectorAll('.merge-box-button');
    if (!mergeButtons.length) return;

    if (totalPercentage < 100) {
        // Disable all merge buttons
        mergeButtons.forEach(button => {
            button.disabled = true;
            button.style.cursor = 'not-allowed';
            button.style.opacity = '0.6';
        });
        
        // Create or update tooltip
        let tooltip = document.querySelector('.pr-checklist-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'pr-checklist-tooltip';
            document.body.appendChild(tooltip);
        }

        // Update tooltip content
        tooltip.textContent = `Complete all checklist items before merging (${totalPercentage}% done)`;
        
        // Show tooltip on hover for any merge button
        mergeButtons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                const rect = button.getBoundingClientRect();
                tooltip.style.display = 'block';
                tooltip.style.top = `${rect.bottom + 5}px`;
                tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
            });

            button.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        });

        // Also disable the menu items
        const menuItems = document.querySelectorAll('.select-menu-item');
        menuItems.forEach(item => {
            item.style.opacity = '0.6';
            item.style.cursor = 'not-allowed';
            item.setAttribute('disabled', 'true');
        });

        // Clear completion flag when progress drops below 100%
        sessionStorage.removeItem('prProgressComplete');
    } else {
        // Enable all merge buttons
        mergeButtons.forEach(button => {
            button.disabled = false;
            button.style.cursor = 'pointer';
            button.style.opacity = '1';
        });
        
        // Enable menu items
        const menuItems = document.querySelectorAll('.select-menu-item');
        menuItems.forEach(item => {
            item.style.opacity = '1';
            item.style.cursor = 'pointer';
            item.removeAttribute('disabled');
        });
        
        // Remove tooltip if it exists
        const tooltip = document.querySelector('.pr-checklist-tooltip');
        if (tooltip) {
            tooltip.remove();
        }

        // Trigger confetti if we just reached 100%
        const progressKey = 'prProgressComplete';
        const isAlreadyComplete = sessionStorage.getItem(progressKey);
        
        if (!isAlreadyComplete) {
            createConfetti();
            sessionStorage.setItem(progressKey, 'true');
        }
    }
}

// Wait for merge button to appear and update its state -> prevent unnecessary dom queries
const observeMergeButton = () => {
    const observer = new MutationObserver((mutations, obs) => {
        const mergeButtons = document.querySelectorAll('.merge-box-button');
        if (mergeButtons.length) {
            updateMergeButtonState();
            obs.disconnect(); // Stop observing once we find the buttons
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
};

// inspired by https://codepen.io/Kcreation-MTech/pen/JjgqWQg
function createConfetti() {
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Confetti parameters
    const confettis = [];
    const colors = ["#FF007A", "#7A00FF", "#00FF7A", "#FFD700", "#00D4FF"];
    const confettiCount = 200;

    // Create initial confetti
    for (let i = 0; i < confettiCount; i++) {
        confettis.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height, // Start above screen
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedX: Math.random() * 3 - 1.5,
            speedY: Math.random() * 5 + 2,
            rotation: Math.random() * 360
        });
    }

    // Animation function
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        confettis.forEach((confetti, index) => {
            // Update position
            confetti.x += confetti.speedX;
            confetti.y += confetti.speedY;
            confetti.rotation += confetti.speedX;
            
            // Draw confetti
            ctx.save();
            ctx.translate(confetti.x, confetti.y);
            ctx.rotate((confetti.rotation * Math.PI) / 180);
            ctx.fillStyle = confetti.color;
            ctx.fillRect(-confetti.size / 2, -confetti.size / 2, confetti.size, confetti.size);
            ctx.restore();
            
            // Remove confetti if it's off screen
            if (confetti.y > canvas.height) {
                confettis.splice(index, 1);
            }
        });
        
        // Continue animation if there are confetti left
        if (confettis.length > 0) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }

    // Start animation
    requestAnimationFrame(animate);
}

// Dark mode functionality
function initializeDarkMode() {
    // Get saved theme preference or use system preference
    const savedColorMode = localStorage.getItem('pr-progress-color-mode') || 'auto';
    const systemColorMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const colorMode = savedColorMode === 'auto' ? systemColorMode : savedColorMode;
    
    // Set initial color mode
    document.documentElement.setAttribute('data-color-mode', colorMode);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (savedColorMode === 'auto') {
            const newColorMode = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-color-mode', newColorMode);
            updateThemeButton(newColorMode);
        }
    });
}

function getThemeIcon(mode) {
    switch (mode) {
        case 'dark': return '☀️';
        case 'light': return '🌙';
        case 'auto': return '🌓';
        default: return '🌓';
    }
}

function getThemeTitle(mode) {
    switch (mode) {
        case 'dark': return 'Switch to light mode';
        case 'light': return 'Switch to dark mode';
        case 'auto': return 'Switch to system theme';
        default: return 'Toggle theme';
    }
}

function cycleTheme() {
    const currentMode = localStorage.getItem('pr-progress-color-mode') || 'auto';
    const modes = ['light', 'dark', 'auto'];
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    localStorage.setItem('pr-progress-color-mode', nextMode);
    
    if (nextMode === 'auto') {
        const systemColorMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-color-mode', systemColorMode);
    } else {
        document.documentElement.setAttribute('data-color-mode', nextMode);
    }
    
    updateThemeButton(nextMode);
}

function updateThemeButton(mode) {
    const themeButton = document.querySelector('.theme-toggle');
    if (themeButton) {
        themeButton.innerHTML = getThemeIcon(mode);
        themeButton.title = getThemeTitle(mode);
    }
}

// Initial state
observeMergeButton();
updateMergeButtonState();

// Initialize dark mode before creating overlay
initializeDarkMode();

// Initial creation
createProgressOverlay();

// Listen for keyboard command
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'toggle-overlay') {
        const existingOverlay = document.querySelector('.pr-progress-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        } else {
            createProgressOverlay();
        }
    }
});