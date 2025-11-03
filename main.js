/*
 * Main JavaScript for Asset Downloader
 * Simplified to use Asset ID directly.
 * This version uses a custom Cloudflare Worker proxy.
 */

$(document).ready(function () {
    $('#submitAsset').on('click', function () {
        processOptions();
    });
    updateDownloadAmount(); // Note: This will no longer work, see below.
});

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !!  PASTE YOUR NEW CLOUDFLARE WORKER URL HERE                        !!
// !!  (It should look like: https://my-asset-proxy.username.workers.dev) !!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
const PROXY_BASE_URL = 'https://YOUR-WORKER-URL.workers.dev';

// --- End of new URL ---

// The official Roblox API endpoint
const ROBLOX_API_URL = 'https://assetdelivery.roblox.com/v1/asset/?id=';

// The endpoint for our proxy (which we will use for the download)
const DOWNLOAD_ENDPOINT = `${PROXY_BASE_URL}?url=`;

/**
 * Validates the form and starts the asset download.
 */
function processOptions() {
    const assetId = $('#assetID').val().trim();

    hideError();
    $('#submitAsset').prop('disabled', true);
    $('#submitAsset').val('Working...');

    // --- Input Validation ---
    if (!assetId) {
        showError('Please enter an Asset ID.');
        enableSubmitButton();
        return;
    }
    // Simple check to see if it's a number
    if (isNaN(assetId)) {
        showError('Please enter a valid number for the Asset ID.');
        enableSubmitButton();
        return;
    }
    
    showLoadMsg('Downloading asset...');

    // --- Start Download ---
    // We build the full Roblox API URL
    const fullDownloadUrl = ROBLOX_API_URL + assetId;
    
    // We set the filename to the Asset ID. 
    // We don't know the file type (e.g., .png or .rbxm) because the category
    // dropdown was removed, so we'll let the user rename it.
    const fileName = assetId; 

    downloadAsset(fullDownloadUrl, fileName);
}


/**
 * Triggers the file download via the proxy.
 * @param {string} url - The *full* Roblox Asset Delivery URL.
 * @param {string} filename - The desired name for the downloaded file.
 */
async function downloadAsset(url, filename) {
    try {
        // We fetch the asset *through our proxy* to avoid CORS errors
        const response = await fetch(DOWNLOAD_ENDPOINT + encodeURIComponent(url));
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText} (Status: ${response.status})`);
        }

        const blob = await response.blob();
        
        // Create a temporary link to trigger the browser download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        
        // Clean up the temporary link
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        changeLoadMsg('Download complete!');
        
        // This function no longer works, but we call it to prevent errors
        submitDownloadAmount(url, 'unknown'); // 'unknown' since we removed type
        
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
function showError(message) { $('#errorMsg').text(message).show(); }
function hideError() { $('#errorMsg').hide(); }
function showLoadMsg(message) { $('#loadMsg').text(message).show(); $('#submitAsset').hide(); }
function hideLoadMsg() { $('#loadMsg').hide(); $('#submitAsset').show(); }
function changeLoadMsg(message) { $('#loadMsg').text(message); }

// --- API Statistics Functions ---
// These functions will no longer work because api.robloxasset.com is dead.
// I have left them here, but they will just fail silently.
// This is why the "Total Downloads" will stop updating.
function getDownloadAmount() {
    console.warn('getDownloadAmount() is disabled; old API is offline.');
    $('#totalDownloads').text('N/A');
}
function submitDownloadAmount(url, type) {
    console.warn('submitDownloadAmount() is disabled; old API is offline.');
}
