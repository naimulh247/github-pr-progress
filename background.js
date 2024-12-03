// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-overlay') {
        // Send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { command: 'toggle-overlay' });
            }
        });
    }
});
