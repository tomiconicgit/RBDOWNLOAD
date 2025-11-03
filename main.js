/*
 * Main JavaScript for Asset Downloader
 * Rewritten to be reliable and maintainable.
 * This version fixes the scraping error by using the Asset ID for all types.
 */

$(document).ready(function () {
    // Set up the click handler for the download button
    $('#submitAsset').on('click', function () {
        processOptions();
    });

    // Load the initial download count
    updateDownloadAmount();

    // Set up a timer to refresh the download count every 5 seconds
    setInterval(updateDownloadAmount, 5000); // 5000ms = 5 seconds
});

// A variable to store the original URL for API submission
var originalURL;

// Base URLs for the proxy API
// This proxy is used to bypass CORS (Cross-Origin Resource Sharing) issues
const API_BASE_URL = 'https://api.robloxasset.com';
const FETCH_ENDPOINT = `${API_BASE_URL}/fetch?url=`;
const DOWNLOAD_ENDPOINT = `${API_BASE_URL}/download?url=`;

/**
 * Validates the form and starts the asset fetch process.
 */
function processOptions() {
    const assetURL = $('#assetURL').val().trim();
    const assetType = $('#assetType').val();
    originalURL = assetURL; // Store for later

    // Clear any previous errors
    hideError();

    // Disable the button to prevent multiple clicks
    $('#submitAsset').prop('disabled', true);
    $('#submitAsset').val('Working...');

    // --- Input Validation ---
    if (!assetURL && assetType === 'placeholder') {
        showError('Please enter an asset URL and select an asset type.');
        enableSubmitButton();
        return;
    }
    if (!assetURL) {
        showError('Please enter an asset URL.');
        enableSubmitButton();
        return;
    }
    if (assetType === 'placeholder') {
        showError('Please select an asset type.');
        enableSubmitButton();
        return;
    }
    if (assetURL.indexOf('roblox.com') === -1 && assetURL.indexOf('create.roblox.com') === -1) {
        showError('Please enter a valid roblox.com or create.roblox.com URL.');
        enableSubmitButton();
        return;
    }
    
    showLoadMsg('Fetching asset info...');

    // --- Start Fetching ---
    // The "sound" type uses a different API endpoint (assetId only)
    if (assetType === 'sound') {
        try {
            const assetId = getAssetIdFromUrl(assetURL);
            if (!assetId) throw new Error('Could not parse Asset ID from URL.');
            // Sounds are fetched using an XML endpoint
            fetchContents(`https://www.roblox.com/asset/?id=${assetId}`, assetType);
        } catch (err) {
            showError(`Invalid Sound URL. ${err.message}`);
            enableSubmitButton();
        }
    } else {
        // All other types just need the asset ID.
        // We fetch the page *only* to try and get the asset's name for the filename.
        fetchContents(assetURL, assetType);
    }
}

/**
 * Gets the asset ID from various Roblox URL formats.
 * @param {string} url - The Roblox URL.
 * @returns {string|null} The asset ID or null.
 */
function getAssetIdFromUrl(url) {
    // Matches .../library/12345/... or .../asset/12345/...
    const match = url.match(/(?:\/library\/|\/asset\/)([0-9]+)/);
    if (match && match[1]) {
        return match[1];
    }
    
    // Fallback for simple /12345/ links
    const parts = url.split('/');
    for(let i = 0; i < parts.length; i++) {
        if (/^[0-9]{8,}$/.test(parts[i])) { // A simple check for a long number
            return parts[i];
        }
    }
    return null;
}

/**
 * Fetches the HTML or XML data from the proxy API.
 * @param {string} url - The URL to fetch.
 * @param {string} assetType - The type of asset.
 */
async function fetchContents(url, assetType) {
    try {
        const response = await fetch(FETCH_ENDPOINT + encodeURIComponent(url));
        if (!response.ok) {
            throw new Error(`Network error: ${response.statusText}`);
        }
        
        const data = await response.text();

        if (assetType === 'sound') {
            parseXML(data, assetType);
        } else {
            // All other types use the Asset ID.
            // We pass the HTML data to *try* and get a name.
            parseAndDownload(data, assetType, url);
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        showError(`Failed to fetch asset data: ${error.message}`);
        hideLoadMsg();
        enableSubmitButton();
    }
}

/**
 * Parses the XML response for 'sound' assets.
 * @param {string} xmlData - The raw XML string.
 * @param {string} assetType - The type of asset.
 */
function parseXML(xmlData, assetType) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
        
        // Find the <Content> tag and get its URL
        const contentTag = xmlDoc.getElementsByTagName('Content')[0];
        const downloadUrl = contentTag.textContent;

        // Try to get a name from the URL, default to 'sound.ogg'
        let fileName = 'sound.ogg';
        const namePart = originalURL.split('/')[5];
        if (namePart) {
            fileName = namePart.replace(/[^a-zA-Z0-9]/g, '_') + '.ogg';
        }

        changeLoadMsg('Downloading sound...');
        downloadAsset(downloadUrl, fileName, assetType);
    } catch (error) {
        console.error('Parse XML Error:', error);
        showError('Failed to parse sound data. The asset might be off-sale.');
        hideLoadMsg();
        enableSubmitButton();
    }
}

/**
 * Main function to download Models, Decals, Plugins, Clothing, etc.
 * This function no longer relies on complex HTML scraping for download links.
 * @param {string} htmlData - The raw HTML string (used only to find the asset name).
 * @param {string} assetType - The type of asset.
 * @param {string} assetPageUrl - The original Roblox URL.
 */
function parseAndDownload(htmlData, assetType, assetPageUrl) {
    try {
        // --- 1. Get the Asset ID (The reliable part) ---
        const assetId = getAssetIdFromUrl(assetPageUrl);
        if (!assetId) {
            throw new Error('Could not parse Asset ID from the URL.');
        }

        // --- 2. Get the Filename (The fragile part) ---
        let fileName = `${assetId}_${assetType}`; // Default filename
        try {
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(htmlData, 'text/html');
            // This is the new selector. Roblox pages now use an H1 for the title.
            // We also check for the old `h2` just in case.
            const nameElement = htmlDoc.querySelector('h1.item-title, h1, h2.item-name, h2');
            if (nameElement) {
                fileName = nameElement.textContent.trim().replace(/[^a-zA-Z0-9 ]/g, '');
            }
        } catch (e) {
            console.warn('Could not parse asset name, using default.');
        }

        // --- 3. Set File Extension ---
        const fileExtensions = {
            'model': '.rbxm',
            'plugin': '.rbxm',
            'mesh': '.rbxm',
            'accessory': '.rbxm',
            'clothing': '.png',
            'decal': '.png'
        };
        fileName += fileExtensions[assetType] || '.asset';

        // --- 4. Get the Download URL (The reliable part) ---
        // All these asset types can be downloaded from the same API endpoint.
        const downloadUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`;
        
        console.log('Asset ID:', assetId);
        console.log('Download URL:', downloadUrl);
        console.log('File Name:', fileName);

        changeLoadMsg('Downloading asset...');
        downloadAsset(downloadUrl, fileName, assetType);

    } catch (error) {
        console.error('Parse Error:', error);
        showError(`Failed to process the asset. (Error: ${error.message})`);
        hideLoadMsg();
        enableSubmitButton();
    }
}

/**
 * Triggers the file download via the proxy.
 * @param {string} url - The direct asset URL (e.g., from assetdelivery.roblox.com).
 * @param {string} filename - The desired name for the downloaded file.
 * @param {string} assetType - The type of asset.
 */
async function downloadAsset(url, filename, assetType) {
    try {
        const response = await fetch(DOWNLOAD_ENDPOINT + encodeURIComponent(url));
        if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText}`);
        }

        const blob = await response.blob();
        
        // Create a temporary link element to trigger the download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        
        // Clean up the temporary link
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        changeLoadMsg('Download complete!');
        
        // Report the download to the API
        submitDownloadAmount(originalURL, assetType);
        
        setTimeout(() => {
            hideLoadMsg();
            enableSubmitButton();
        }, 1500);

    } catch (error) {
        console.error('Download Error:', error);
        showError(`Download failed: ${error.message}`);
        hideLoadMsg();
        enableSubmitButton();
    }
}

/**
 * Re-enables the submit button and resets its text.
 */
function enableSubmitButton() {
    $('#submitAsset').prop('disabled', false);
    $('#submitAsset').val('Download Asset');
}

// --- UI Helper Functions ---

function showError(message) {
    $('#errorMsg').text(message).show();
}

function hideError() {
    $('#errorMsg').hide();
}

function showLoadMsg(message) {
    $('#loadMsg').text(message).show();
    $('#submitAsset').hide();
}

function hideLoadMsg() {
    $('#loadMsg').hide();
    $('#submitAsset').show();
}

function changeLoadMsg(message) {
    $('#loadMsg').text(message);
}

// --- API Statistics Functions ---

/**
 * Fetches the total download count from the API.
 */
function getDownloadAmount() {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                $('#totalDownloads').text(xhr.responseText);
            }
        }
    };
    xhr.open('GET', `${API_BASE_URL}/downloads`, true);
    xhr.send(null);
}

/**
 * Submits a successful download to the API for tracking.
 * @param {string} url - The original Roblox URL.
 * @param {string} type - The asset type.
 */
function submitDownloadAmount(url, type) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            console.log('Submit Download Response:', xhr.responseText);
        }
    };
    xhr.open('GET', `${API_BASE_URL}/submit?url=${btoa(url)}&type=${btoa(type)}`, true);
    xhr.send(null);
}
