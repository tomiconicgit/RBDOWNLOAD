/*
 * Main JavaScript for Asset Downloader
 * De-obfuscated and rewritten for readability.
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
    if (assetURL.indexOf('roblox.com') === -1) {
        showError('Please enter a valid roblox.com URL.');
        enableSubmitButton();
        return;
    }
    
    showLoadMsg('Fetching asset info...');

    // --- Start Fetching ---
    // The "sound" type uses a different API endpoint (assetId only)
    if (assetType === 'sound') {
        try {
            const assetId = assetURL.split('/')[4];
            if (!assetId) throw new Error('Could not parse Asset ID from URL.');
            // Sounds are fetched using an XML endpoint
            fetchContents(`https://www.roblox.com/asset/?id=${assetId}`, assetType);
        } catch (err) {
            showError(`Invalid Sound URL. ${err.message}`);
            enableSubmitButton();
        }
    } else {
        // All other types use the URL directly
        fetchContents(assetURL, assetType);
    }
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
            parseHTML(data, assetType, url);
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
        if (originalURL.split('/')[5]) { // e.g., /4951534350/Astronomia
            fileName = originalURL.split('/')[5].replace(/[^a-zA-Z0-9]/g, '_') + '.ogg';
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
 * Parses the HTML response for all non-sound assets.
 * @param {string} htmlData - The raw HTML string.
 * @param {string} assetType - The type of asset.
 * @param {string} assetPageUrl - The original Roblox URL.
 */
function parseHTML(htmlData, assetType, assetPageUrl) {
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // !!                                                               !!
    // !!  ATTENTION: This is the function that is causing your error.  !!
    // !!  Roblox has changed its website layout, so the selectors      !!
    // !!  (e.g., 'h2', 'img.asset-image') are no longer valid.         !!
    // !!  You must update these selectors to fix the script.           !!
    // !!                                                               !!
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    try {
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(htmlData, 'text/html');
        let downloadUrl = '';
        let fileName = '';

        // --- Logic for asset name (This is what was failing) ---
        // OLD LOGIC: htmlDoc.getElementsByTagName('h2')[0].textContent
        // This is a guess for the new selector. You MUST verify this.
        const nameElement = htmlDoc.querySelector('h2.item-name, .item-name-container h1');
        if (!nameElement) {
             // If we can't find a name, use a default
            fileName = `${assetType}_${Date.now()}`;
        } else {
            fileName = nameElement.textContent.trim();
        }

        // --- Logic for Download URL ---
        const assetTypesWithAssetId = ['accessory', 'clothing', 'mesh', 'model'];

        if (assetType === 'decal') {
            // OLD LOGIC: htmlDoc.getElementsByClassName('asset-image')[0].src
            const imageElement = htmlDoc.querySelector('img.asset-image'); // This is likely wrong
            if (!imageElement) throw new Error('Could not find decal image element.');
            downloadUrl = imageElement.src;
            fileName += '.png';
        
        } else if (assetType === 'plugin') {
            // OLD LOGIC: htmlDoc.getElementsByClassName('plugin-asset')[0].href
            const pluginElement = htmlDoc.querySelector('a.plugin-asset'); // This is likely wrong
            if (!pluginElement) throw new Error('Could not find plugin download element.');
            downloadUrl = pluginElement.href;
            fileName += '.rbxm';
        
        } else if (assetTypesWithAssetId.includes(assetType)) {
            // This logic relies on the asset ID
            const assetId = assetPageUrl.split('/')[4];
            if (!assetId) throw new Error('Could not parse Asset ID from URL.');
            downloadUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`;
            fileName += '.rbxm'; // Model/Accessory
            if (assetType === 'clothing') fileName += '.png'; // Clothing
        }
        
        if (!downloadUrl) {
            throw new Error('Could not determine a download URL.');
        }

        console.log('Download URL:', downloadUrl);
        console.log('File Name:', fileName);

        changeLoadMsg('Downloading asset...');
        downloadAsset(downloadUrl, fileName, assetType);

    } catch (error) {
        console.error('Parse HTML Error:', error);
        // This is the error you are seeing
        showError(`Failed to parse page data. Roblox may have updated its site. (Error: ${error.message})`);
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
    // This uses the old XMLHttpRequest, but works fine.
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
    // btoa() is used to encode the URL and type for safe transport
    xhr.open('GET', `${API_BASE_URL}/submit?url=${btoa(url)}&type=${btoa(type)}`, true);
    xhr.send(null);
}
