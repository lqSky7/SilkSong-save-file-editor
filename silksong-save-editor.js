/**
 * Silksong Save Editor - JavaScript implementation
 * Adapted from Hollow Knight Save Manager decryption logic
 */

class SilksongSaveEditor {
    constructor() {
        // Constants from Hollow Knight SaveLoader.java - same encryption method likely used
        this.CIPHER_KEY = "UKu52ePUBwetZ9wNX88o54dnfKRu0T1l";
        this.BLOCK_SIZE = 16;
        
        // C# binary header from Hollow Knight - likely same for Silksong
        this.CSHARP_HEADER = new Uint8Array([
            0x00, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 
            0xFF, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x06, 0x01, 0x00, 0x00, 0x00
        ]);
        
        this.saveData = null;
    }

    /**
     * Decrypt AES data using the same method as Hollow Knight
     * Uses AES-256-ECB with PKCS7 padding
     */
    decryptAES(encryptedData, key) {
        try {
            // Convert key to proper format
            const keyWords = CryptoJS.enc.Utf8.parse(key);
            
            // Convert base64 encrypted data to bytes
            const encrypted = CryptoJS.enc.Base64.parse(encryptedData);
            
            // Decrypt using AES ECB mode with PKCS7 padding
            const decrypted = CryptoJS.AES.decrypt({
                ciphertext: encrypted
            }, keyWords, {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
            });
            
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt save data');
        }
    }

    /**
     * Encrypt JSON data using the same method as Hollow Knight
     */
    encryptAES(jsonString, key) {
        try {
            const keyWords = CryptoJS.enc.Utf8.parse(key);
            
            const encrypted = CryptoJS.AES.encrypt(jsonString, keyWords, {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
            });
            
            return encrypted.toString();
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt save data');
        }
    }

    /**
     * Parse C# variable length encoded integer
     * Adapted from getLength method in SaveLoader.java
     */
    parseVariableLength(data, offset) {
        let length = 0;
        let shift = 0;
        let index = offset;
        
        while (index < data.length) {
            const byte = data[index++];
            length |= (byte & 0x7F) << shift;
            
            if ((byte & 0x80) === 0) {
                break;
            }
            shift += 7;
        }
        
        return { length, nextOffset: index };
    }

    /**
     * Create C# variable length encoded integer
     */
    createVariableLength(value) {
        const result = [];
        
        while (value >= 0x80) {
            result.push((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        result.push(value & 0x7F);
        
        return new Uint8Array(result);
    }

    /**
     * Load and decrypt a Silksong save file
     */
    async loadSave(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            // Check if it's already JSON (unencrypted)
            const firstChar = String.fromCharCode(data[0]);
            if (firstChar === '{') {
                const jsonString = new TextDecoder().decode(data);
                this.saveData = JSON.parse(jsonString);
                return this.saveData;
            }
            
            // Verify C# header
            const headerMatch = this.CSHARP_HEADER.every((byte, index) => 
                index < data.length && data[index] === byte
            );
            
            if (!headerMatch) {
                throw new Error('Invalid save file format - header mismatch');
            }
            
            // Parse variable length encoded size
            const { length: encryptedDataLength, nextOffset } = 
                this.parseVariableLength(data, this.CSHARP_HEADER.length);
            
            // Extract encrypted data (skip the final 0x0B byte)
            const encryptedData = data.slice(nextOffset, nextOffset + encryptedDataLength);
            
            // Convert to base64 string for decryption
            const base64String = btoa(String.fromCharCode.apply(null, encryptedData));
            
            // Decrypt the data
            const decryptedJson = this.decryptAES(base64String, this.CIPHER_KEY);
            
            if (!decryptedJson) {
                throw new Error('Decryption resulted in empty data');
            }
            
            // Parse JSON
            this.saveData = JSON.parse(decryptedJson);
            return this.saveData;
            
        } catch (error) {
            console.error('Error loading save:', error);
            throw new Error(`Failed to load save file: ${error.message}`);
        }
    }

    /**
     * Save the current data back to encrypted format
     */
    createSaveFile() {
        if (!this.saveData) {
            throw new Error('No save data loaded');
        }
        
        try {
            // Validate and clean save data (adapted from validateSaveData)
            this.validateSaveData();
            
            // Convert to JSON string
            let jsonString = JSON.stringify(this.saveData);
            
            // Clean up JSON string (remove trailing whitespace/newlines like in original)
            jsonString = jsonString.replace(/\s+$/, '');
            
            // Encrypt the JSON
            const encryptedBase64 = this.encryptAES(jsonString, this.CIPHER_KEY);
            
            // Convert base64 back to bytes
            const encryptedBytes = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            
            // Remove carriage returns and line feeds (like in original)
            const cleanedBytes = encryptedBytes.filter(byte => 
                byte !== 0x0D && byte !== 0x0A
            );
            
            // Create variable length encoding of data size
            const lengthBytes = this.createVariableLength(cleanedBytes.length);
            
            // Combine all parts
            const totalLength = this.CSHARP_HEADER.length + lengthBytes.length + 
                              cleanedBytes.length + 1; // +1 for final 0x0B byte
            
            const result = new Uint8Array(totalLength);
            let offset = 0;
            
            // Copy header
            result.set(this.CSHARP_HEADER, offset);
            offset += this.CSHARP_HEADER.length;
            
            // Copy length encoding
            result.set(lengthBytes, offset);
            offset += lengthBytes.length;
            
            // Copy encrypted data
            result.set(cleanedBytes, offset);
            offset += cleanedBytes.length;
            
            // Add final byte
            result[offset] = 0x0B;
            
            return result;
            
        } catch (error) {
            console.error('Error creating save file:', error);
            throw new Error(`Failed to create save file: ${error.message}`);
        }
    }

    /**
     * Validate and fix save data (adapted from validateSaveData and validateCharms)
     */
    validateSaveData() {
        if (!this.saveData || !this.saveData.playerData) {
            return;
        }
        
        const playerData = this.saveData.playerData;
        
        // Fix boolean values that might be stored as integers
        const booleanFields = [
            'hasNeedleDash', 'hasWallRun', 'hasDoubleJump', 'hasBellBind',
            'permadeathMode', 'canDash'
        ];
        
        booleanFields.forEach(field => {
            if (playerData.hasOwnProperty(field)) {
                playerData[field] = Boolean(playerData[field]);
            }
        });
        
        // Validate numeric ranges
        if (playerData.health !== undefined) {
            playerData.health = Math.max(1, Math.min(20, parseInt(playerData.health) || 5));
        }
        
        if (playerData.geo !== undefined) {
            playerData.geo = Math.max(0, Math.min(999999, parseInt(playerData.geo) || 0));
        }
        
        if (playerData.silk !== undefined) {
            playerData.silk = Math.max(0, Math.min(999, parseInt(playerData.silk) || 0));
        }
    }

    /**
     * Get player summary information
     */
    getPlayerSummary() {
        if (!this.saveData || !this.saveData.playerData) {
            return null;
        }
        
        const pd = this.saveData.playerData;
        return {
            playerName: pd.playerName || 'Unknown',
            health: pd.health || 5,
            geo: pd.geo || 0,
            silk: pd.silk || 0,
            location: pd.currentScene || 'Unknown',
            playTime: pd.playTime || 0
        };
    }

    /**
     * Update player data
     */
    updatePlayerData(updates) {
        if (!this.saveData || !this.saveData.playerData) {
            throw new Error('No save data loaded');
        }
        
        Object.assign(this.saveData.playerData, updates);
        this.validateSaveData();
    }
}

// Global instance
const saveEditor = new SilksongSaveEditor();

// UI Functions
function showStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = `<div class="${isError ? 'error' : 'success'}">${message}</div>`;
}

function loadSave() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showStatus('Please select a save file first.', true);
        return;
    }
    
    showStatus('Loading save file...');
    
    saveEditor.loadSave(file)
        .then(saveData => {
            showStatus('Save file loaded successfully!');
            populateEditor(saveData);
            document.getElementById('editorContainer').style.display = 'block';
        })
        .catch(error => {
            showStatus(error.message, true);
            console.error('Load error:', error);
        });
}

function populateEditor(saveData) {
    if (!saveData.playerData) {
        showStatus('Warning: No player data found in save file.', true);
        return;
    }
    
    const pd = saveData.playerData;
    
    // Populate basic fields
    document.getElementById('playerName').value = pd.playerName || '';
    document.getElementById('geo').value = pd.geo || 0;
    document.getElementById('health').value = pd.health || 5;
    document.getElementById('silk').value = pd.silk || 0;
    
    // Populate abilities
    document.getElementById('hasNeedleDash').checked = Boolean(pd.hasNeedleDash);
    document.getElementById('hasWallRun').checked = Boolean(pd.hasWallRun);
    document.getElementById('hasDoubleJump').checked = Boolean(pd.hasDoubleJump);
    document.getElementById('hasBellBind').checked = Boolean(pd.hasBellBind);
}

function saveSave() {
    try {
        // Collect updated values from UI
        const updates = {
            playerName: document.getElementById('playerName').value,
            geo: parseInt(document.getElementById('geo').value) || 0,
            health: parseInt(document.getElementById('health').value) || 5,
            silk: parseInt(document.getElementById('silk').value) || 0,
            hasNeedleDash: document.getElementById('hasNeedleDash').checked,
            hasWallRun: document.getElementById('hasWallRun').checked,
            hasDoubleJump: document.getElementById('hasDoubleJump').checked,
            hasBellBind: document.getElementById('hasBellBind').checked
        };
        
        saveEditor.updatePlayerData(updates);
        showStatus('Save data updated successfully!');
        
    } catch (error) {
        showStatus(error.message, true);
        console.error('Save error:', error);
    }
}

function downloadSave() {
    try {
        const saveFileData = saveEditor.createSaveFile();
        
        const blob = new Blob([saveFileData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'user1.dat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('Save file downloaded successfully!');
        
    } catch (error) {
        showStatus(error.message, true);
        console.error('Download error:', error);
    }
}

function showRawData() {
    const container = document.getElementById('rawDataContainer');
    const rawDataDiv = document.getElementById('rawData');
    
    if (saveEditor.saveData) {
        rawDataDiv.textContent = JSON.stringify(saveEditor.saveData, null, 2);
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
    } else {
        showStatus('No save data loaded.', true);
    }
}
