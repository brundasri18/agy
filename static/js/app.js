// State Management
let releaseNotes = [];
let filteredNotes = [];
const selectedIds = new Set();
let currentFilterType = 'all';
let currentSearchQuery = '';
let currentSort = 'newest';

// DOM Elements
const loaderEl = document.getElementById('loader');
const errorContainerEl = document.getElementById('error-container');
const errorMessageEl = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const emptyStateEl = document.getElementById('empty-state');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const timelineContainerEl = document.getElementById('timeline-container');
const timelineItemsEl = document.getElementById('timeline-items');

const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const lastUpdatedText = document.getElementById('last-updated-text');

const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterChipsContainer = document.getElementById('filter-chips');
const resultsCountEl = document.getElementById('results-count');
const sortSelect = document.getElementById('sort-select');

// Selection Drawer Elements
const selectionBar = document.getElementById('selection-bar');
const selectionCountEl = document.getElementById('selection-count');
const selectionPreviewEl = document.getElementById('selection-preview');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const tweetSelectionBtn = document.getElementById('tweet-selection-btn');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const charProgress = document.getElementById('char-progress');
const charWarning = document.getElementById('char-warning');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const postTweetBtn = document.getElementById('post-tweet-btn');

// Progress Ring Configuration
const ringRadius = 10;
const ringCircumference = 2 * Math.PI * ringRadius;
if (charProgress) {
    charProgress.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
    charProgress.style.strokeDashoffset = ringCircumference;
}

// -------------------------------------------------------------
// Initialization & API Operations
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

function setupEventListeners() {
    // Refresh and Retry
    refreshBtn.addEventListener('click', refreshReleaseNotes);
    retryBtn.addEventListener('click', fetchReleaseNotes);
    
    // Search
    searchInput.addEventListener('input', handleSearchInput);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Filter Chips
    filterChipsContainer.addEventListener('click', handleFilterClick);
    
    // Sorting
    sortSelect.addEventListener('change', handleSortChange);
    
    // Reset Empty State
    resetFiltersBtn.addEventListener('click', resetAllFilters);
    
    // Selection Drawer Actions
    clearSelectionBtn.addEventListener('click', clearAllSelection);
    tweetSelectionBtn.addEventListener('click', openComposerForSelection);
    
    // Modal Actions
    closeModalBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });
    
    tweetTextarea.addEventListener('input', updateTweetCharCount);
    copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    postTweetBtn.addEventListener('click', postTweetToTwitter);
}

async function fetchReleaseNotes(forceRefresh = false) {
    showState('loading');
    
    const endpoint = forceRefresh ? '/api/refresh' : '/api/notes';
    const method = forceRefresh ? 'POST' : 'GET';
    
    try {
        const response = await fetch(endpoint, { method });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        releaseNotes = data.items || [];
        updateLastUpdatedTime(data.fetched_at);
        
        // Retain selections only if they still exist in the new dataset
        const currentItemIds = new Set(releaseNotes.map(item => item.id));
        for (let selectedId of selectedIds) {
            if (!currentItemIds.has(selectedId)) {
                selectedIds.delete(selectedId);
            }
        }
        updateSelectionBar();
        
        applyFiltersAndRender();
    } catch (error) {
        console.error('Fetch error:', error);
        errorMessageEl.textContent = `Error: ${error.message}. Please verify the Flask server is running.`;
        showState('error');
    }
}

function refreshReleaseNotes() {
    if (refreshIcon.classList.contains('spinning')) return;
    
    refreshIcon.classList.add('spinning');
    refreshBtn.disabled = true;
    
    fetchReleaseNotes(true).finally(() => {
        refreshIcon.classList.remove('spinning');
        refreshBtn.disabled = false;
    });
}

function updateLastUpdatedTime(timestamp) {
    if (!timestamp) {
        lastUpdatedText.textContent = "Last updated: Never";
        return;
    }
    
    const date = new Date(timestamp * 1000);
    // Format: "June 16, 2026 at 11:15 PM"
    const options = { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    lastUpdatedText.textContent = `Last updated: ${date.toLocaleDateString(undefined, options)}`;
}

// -------------------------------------------------------------
// Filters, Sorting & Searching
// -------------------------------------------------------------

function handleSearchInput(e) {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    
    if (currentSearchQuery.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }
    
    applyFiltersAndRender();
}

function clearSearch() {
    searchInput.value = '';
    currentSearchQuery = '';
    clearSearchBtn.style.display = 'none';
    applyFiltersAndRender();
}

function handleFilterClick(e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    
    // Toggle active state in UI
    filterChipsContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    currentFilterType = chip.dataset.type;
    applyFiltersAndRender();
}

function handleSortChange(e) {
    currentSort = e.target.value;
    applyFiltersAndRender();
}

function resetAllFilters() {
    clearSearch();
    
    // Reset Chip active state
    filterChipsContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    filterChipsContainer.querySelector('[data-type="all"]').classList.add('active');
    currentFilterType = 'all';
    
    // Reset Sort select
    sortSelect.value = 'newest';
    currentSort = 'newest';
    
    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    // 1. Filter by category type
    filteredNotes = releaseNotes.filter(item => {
        if (currentFilterType === 'all') return true;
        return item.type.toLowerCase() === currentFilterType;
    });
    
    // 2. Filter by search query
    if (currentSearchQuery) {
        filteredNotes = filteredNotes.filter(item => {
            const matchesContent = item.text_content.toLowerCase().includes(currentSearchQuery);
            const matchesType = item.type.toLowerCase().includes(currentSearchQuery);
            const matchesDate = item.date.toLowerCase().includes(currentSearchQuery);
            return matchesContent || matchesType || matchesDate;
        });
    }
    
    // 3. Apply sorting
    filteredNotes.sort((a, b) => {
        // Compare iso_dates
        if (a.iso_date !== b.iso_date) {
            return currentSort === 'newest' 
                ? b.iso_date.localeCompare(a.iso_date) 
                : a.iso_date.localeCompare(b.iso_date);
        }
        // If dates are identical, maintain sub-index ordering (reverse order for newest)
        const aIndex = parseInt(a.id.split('_')[1] || 0);
        const bIndex = parseInt(b.id.split('_')[1] || 0);
        return currentSort === 'newest' ? aIndex - bIndex : bIndex - aIndex;
    });
    
    // Update count labels
    resultsCountEl.textContent = `Showing ${filteredNotes.length} update${filteredNotes.length === 1 ? '' : 's'}`;
    
    // Render
    if (filteredNotes.length === 0) {
        showState('empty');
    } else {
        renderTimeline();
        showState('content');
    }
}

// -------------------------------------------------------------
// Rendering Content
// -------------------------------------------------------------

function renderTimeline() {
    timelineItemsEl.innerHTML = '';
    
    filteredNotes.forEach((item) => {
        const isSelected = selectedIds.has(item.id);
        const typeClass = `type-${item.type.toLowerCase()}`;
        
        const node = document.createElement('div');
        node.className = `timeline-node ${typeClass} ${isSelected ? 'selected' : ''}`;
        node.dataset.id = item.id;
        
        node.innerHTML = `
            <div class="timeline-marker"></div>
            <article class="timeline-card" onclick="handleCardClick(event, '${item.id}')">
                <header class="card-header">
                    <div class="badge-and-date">
                        <span class="type-badge">${item.type}</span>
                        <span class="card-date">${item.date}</span>
                    </div>
                    <div class="card-select-btn" title="Select this update to tweet" onclick="handleCheckboxClick(event, '${item.id}')">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </header>
                <div class="card-body">
                    ${item.content}
                </div>
                <footer class="card-actions">
                    <a href="${item.link}" target="_blank" rel="noopener" class="action-link" title="Open official release notes page" onclick="event.stopPropagation()">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>Source Docs</span>
                    </a>
                    <span class="action-link tweet-shortcut-btn" title="Tweet just this update" onclick="handleDirectTweet(event, '${item.id}')">
                        <i class="fa-brands fa-x-twitter"></i>
                        <span>Tweet</span>
                    </span>
                </footer>
            </article>
        `;
        
        timelineItemsEl.appendChild(node);
    });
}

function showState(state) {
    loaderEl.classList.add('hidden');
    errorContainerEl.classList.add('hidden');
    emptyStateEl.classList.add('hidden');
    timelineContainerEl.classList.add('hidden');
    
    if (state === 'loading') {
        loaderEl.classList.remove('hidden');
    } else if (state === 'error') {
        errorContainerEl.classList.remove('hidden');
    } else if (state === 'empty') {
        emptyStateEl.classList.remove('hidden');
    } else if (state === 'content') {
        timelineContainerEl.classList.remove('hidden');
    }
}

// -------------------------------------------------------------
// Selections Drawer Logic
// -------------------------------------------------------------

function handleCardClick(event, itemId) {
    // Ignore click if it's on an anchor link or interactive action element
    if (event.target.closest('a') || event.target.closest('.tweet-shortcut-btn') || event.target.closest('.card-select-btn')) {
        return;
    }
    toggleItemSelection(itemId);
}

function handleCheckboxClick(event, itemId) {
    event.stopPropagation();
    toggleItemSelection(itemId);
}

function toggleItemSelection(itemId) {
    if (selectedIds.has(itemId)) {
        selectedIds.delete(itemId);
    } else {
        selectedIds.add(itemId);
    }
    
    // Update card styling directly to avoid full rerender (which breaks smooth UI)
    const node = document.querySelector(`.timeline-node[data-id="${itemId}"]`);
    if (node) {
        node.classList.toggle('selected', selectedIds.has(itemId));
    }
    
    updateSelectionBar();
}

function clearAllSelection() {
    selectedIds.clear();
    
    // Clear styles
    document.querySelectorAll('.timeline-node').forEach(node => {
        node.classList.remove('selected');
    });
    
    updateSelectionBar();
}

function updateSelectionBar() {
    const count = selectedIds.size;
    
    if (count > 0) {
        selectionBar.classList.add('active');
        selectionCountEl.textContent = `${count} update${count === 1 ? '' : 's'} selected`;
        
        // Generate a preview string of what's selected
        const selectedItems = releaseNotes.filter(item => selectedIds.has(item.id));
        const previewText = selectedItems.map(item => `[${item.type}] ${item.text_content}`).join(' | ');
        selectionPreviewEl.textContent = previewText;
    } else {
        selectionBar.classList.remove('active');
    }
}

// -------------------------------------------------------------
// Twitter Composer Modal Operations
// -------------------------------------------------------------

function generateTweetText(item) {
    const prefix = `📢 BigQuery ${item.type} (${item.date}): `;
    const suffix = `\n\n${item.link}`;
    const maxContentLength = 280 - prefix.length - suffix.length;
    
    let content = item.text_content;
    if (content.length > maxContentLength) {
        content = content.substring(0, maxContentLength - 3) + "...";
    }
    
    return `${prefix}${content}${suffix}`;
}

function generateMultiTweetText(items) {
    if (items.length === 1) {
        return generateTweetText(items[0]);
    }
    
    const prefix = `📢 BigQuery Updates:\n`;
    const suffix = `\n\nFull details: https://docs.cloud.google.com/bigquery/docs/release-notes`;
    const maxContentLength = 280 - prefix.length - suffix.length;
    
    let body = "";
    for (let item of items) {
        let line = `• [${item.type}] ${item.text_content}\n`;
        // Check if adding this line exceeds our budget
        if ((body + line).length > maxContentLength) {
            body += "• ...and more updates!\n";
            break;
        }
        body += line;
    }
    
    // Fallback safeguard truncate
    if ((prefix + body + suffix).length > 280) {
        const allowed = 280 - prefix.length - suffix.length - 4;
        body = body.substring(0, allowed) + "...\n";
    }
    
    return `${prefix}${body}${suffix}`;
}

function handleDirectTweet(event, itemId) {
    event.stopPropagation();
    
    const item = releaseNotes.find(n => n.id === itemId);
    if (!item) return;
    
    const draftText = generateTweetText(item);
    openComposerWithText(draftText);
}

function openComposerForSelection() {
    const selectedItems = releaseNotes.filter(item => selectedIds.has(item.id));
    if (selectedItems.length === 0) return;
    
    const draftText = generateMultiTweetText(selectedItems);
    openComposerWithText(draftText);
}

function openComposerWithText(text) {
    tweetTextarea.value = text;
    updateTweetCharCount();
    tweetModal.classList.add('active');
    
    // Focus the textarea
    setTimeout(() => tweetTextarea.focus(), 150);
}

function closeTweetModal() {
    tweetModal.classList.remove('active');
}

function updateTweetCharCount() {
    const length = tweetTextarea.value.length;
    const remaining = 280 - length;
    
    charCounter.textContent = remaining;
    
    // Progress Ring Math
    const percent = Math.min(100, (length / 280) * 100);
    const strokeDashoffset = ringCircumference - (percent / 100) * ringCircumference;
    
    if (charProgress) {
        charProgress.style.strokeDashoffset = strokeDashoffset;
        
        // Color transition for warning states
        if (remaining <= 0) {
            charProgress.style.stroke = '#ef4444'; // Red
            charCounter.style.color = '#ef4444';
            charWarning.classList.remove('hidden');
            postTweetBtn.disabled = true;
        } else if (remaining <= 20) {
            charProgress.style.stroke = '#f59e0b'; // Amber
            charCounter.style.color = '#f59e0b';
            charWarning.classList.add('hidden');
            postTweetBtn.disabled = false;
        } else {
            charProgress.style.stroke = '#1d9bf0'; // Twitter Blue
            charCounter.style.color = '#94a3b8';
            charWarning.classList.add('hidden');
            postTweetBtn.disabled = false;
        }
    }
}

function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    
    navigator.clipboard.writeText(text).then(() => {
        // Change button state temporarily to show success
        const originalContent = copyTweetBtn.innerHTML;
        copyTweetBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Copied!</span>`;
        copyTweetBtn.classList.add('btn-primary');
        copyTweetBtn.classList.remove('btn-secondary');
        
        setTimeout(() => {
            copyTweetBtn.innerHTML = originalContent;
            copyTweetBtn.classList.remove('btn-primary');
            copyTweetBtn.classList.add('btn-secondary');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Could not copy text automatically. Please select the text inside the box and copy manually.');
    });
}

function postTweetToTwitter() {
    const text = tweetTextarea.value;
    if (text.length > 280) {
        alert("The tweet exceeds Twitter's 280 character limit. Please shorten it before posting.");
        return;
    }
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
}
