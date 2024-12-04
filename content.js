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

    overlay.addEventListener('mousedown', e => {
        if (e.target.closest('.pr-progress-header') && !e.target.closest('.pr-progress-controls')) {
            isDragging = true;
            initialX = e.clientX - (savedState.position?.x || 0);
            initialY = e.clientY - (savedState.position?.y || 0);
        }
    });

    document.addEventListener('mousemove', e => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            savedState.position = { x: currentX, y: currentY };
            localStorage.setItem('prProgressState', JSON.stringify(savedState));
            
            overlay.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.body.appendChild(overlay);

    // Show confetti if all tasks are completed
    if (totalStats.completed === totalStats.total && totalStats.total > 0) {
        createConfetti();
    }
}

// Update on checkbox changes
document.addEventListener('change', (e) => {
    if (e.target.matches('.task-list-item-checkbox')) {
        createProgressOverlay();
        updateMergeButtonState();
    }
});

function updateMergeButtonState() {
    const mergeButton = document.querySelector('.merge-message .btn-group-merge .js-merge-commit-button');
    if (!mergeButton) return;

    const groups = findChecklistGroups();
    if (groups.length === 0) return;

    const allTasks = groups.reduce((acc, group) => [...acc, ...group.items], []);
    const allCompleted = allTasks.every(item => item.querySelector('.task-list-item-checkbox').checked);

    if (!allCompleted) {
        mergeButton.disabled = true;
        mergeButton.title = 'Complete all checklist items before merging';
    } else {
        mergeButton.disabled = false;
        mergeButton.title = '';
    }
}

function observeMergeButton() {
    const observer = new MutationObserver((mutations, obs) => {
        const mergeButton = document.querySelector('.merge-message .btn-group-merge .js-merge-commit-button');
        if (mergeButton) {
            updateMergeButtonState();
            obs.disconnect();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// inspired by https://codepen.io/Kcreation-MTech/pen/JjgqWQg
function createConfetti() {
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Confetti particles
    const confettis = [];
    const confettiCount = 300;
    const gravity = 0.5;
    const terminalVelocity = 5;
    const drag = 0.075;
    const colors = [
        { front: '#00FF00', back: '#4CAF50' },  // Green
        { front: '#2196F3', back: '#1976D2' },  // Blue
        { front: '#F44336', back: '#D32F2F' },  // Red
        { front: '#FFEB3B', back: '#FBC02D' }   // Yellow
    ];

    // Confetti class
    class Confetti {
        constructor() {
            this.randomize();
        }

        randomize() {
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.color = color.front;
            this.dimensions = {
                x: (Math.random() * 10) + 5,
                y: (Math.random() * 10) + 5
            };
            this.position = {
                x: Math.random() * canvas.width,
                y: -(Math.random() * canvas.height * 2)
            };
            this.rotation = Math.random() * 2 * Math.PI;
            this.scale = { x: 1, y: 1 };
            this.velocity = {
                x: (Math.random() * 20) - 10,
                y: (Math.random() * 10) + 3
            };
        }

        update() {
            // Update velocity
            this.velocity.x += (Math.random() * 2) - 1;
            this.velocity.y = Math.min(terminalVelocity, this.velocity.y + gravity);

            // Update position
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
            this.rotation += 0.1;

            // Check bounds
            if (this.position.y >= canvas.height) {
                this.position.y = -(Math.random() * canvas.height * 0.5);
                this.position.x = Math.random() * canvas.width;
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            ctx.rotate(this.rotation);
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.dimensions.x * 0.5, -this.dimensions.y * 0.5, this.dimensions.x, this.dimensions.y);
            ctx.restore();
        }
    }

    // Create confetti particles
    for (let i = 0; i < confettiCount; i++) {
        confettis.push(new Confetti());
    }

    // Animation function
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        confettis.forEach((confetti, index) => {
            confetti.update();
            confetti.draw();

            // Remove confetti if it's off screen
            if (confetti.position.y > canvas.height * 1.5) {
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