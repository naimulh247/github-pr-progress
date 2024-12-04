// Load saved position and state
const savedState = JSON.parse(localStorage.getItem('prProgressState') || '{}');

function findChecklistGroups() {
    // Find all task list items
    const allTaskItems = Array.from(document.querySelectorAll('.task-list-item'));
    if (allTaskItems.length === 0) return [];

    const groups = [];
    let currentGroup = null;

    // Function to get the previous header or text node
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

//  Update merge button state
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
        
        // Remove tooltip if exists
        const tooltip = document.querySelector('.pr-checklist-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }
}

// Wait for merge button to appear and update its state
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

// Initial state
observeMergeButton();
updateMergeButtonState();

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