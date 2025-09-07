# 🕷️ Silksong Save Editor

A web-based save editor for Hollow Knight: Silksong, adapted from the Hollow Knight save manager decryption logic.

## Features

- 🔓 **Decrypt/Encrypt** Silksong save files using the same AES-256-ECB encryption as Hollow Knight
- ✏️ **Edit** player data: name, geo, health, silk, abilities
- 💾 **Download** modified save files in the correct encrypted format
- 🎨 **Modern UI** with drag-and-drop file upload
- 📊 **Save Summary** showing key player statistics

## How It Works

The editor replicates the decryption logic from the Hollow Knight SaveLoader.java:

1. **File Structure**: Silksong saves use the same C# binary format as Hollow Knight
2. **Encryption**: AES-256-ECB with PKCS7 padding using key `UKu52ePUBwetZ9wNX88o54dnfKRu0T1l`
3. **Encoding**: Base64 encoding of encrypted JSON data
4. **Header**: Same C# binary header structure

## Installation

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The editor will be available at `http://localhost:3000`

## Usage

1. **Upload** your `user1.dat` save file by dragging it to the upload area
2. **Edit** the player data using the form fields
3. **Update** the save data with your changes
4. **Download** the modified save file

## Supported Fields

### Player Info

- Player Name
- Geo (currency)
- Health
- Silk

### Abilities

- Needle Dash
- Wall Run
- Double Jump
- Bell Bind

## Technical Details

### Decryption Process

1. Read C# binary header (22 bytes)
2. Parse variable-length encoded data size
3. Extract base64 encoded encrypted data
4. Decrypt using AES-256-ECB
5. Parse resulting JSON

### Encryption Process

1. Validate and serialize JSON data
2. Encrypt using AES-256-ECB with PKCS7 padding
3. Encode as base64
4. Add C# header and variable-length size encoding
5. Write binary file

## File Structure

```
silksong-web-editor/
├── server.js           # Node.js server with crypto logic
├── package.json        # Dependencies
├── public/
│   └── index.html     # Web interface
└── README.md          # This file
```

## API Endpoints

- `POST /api/load-save` - Upload and decrypt save file
- `POST /api/save` - Download encrypted save file
- `POST /api/summary` - Get save data summary

## Notes

- The encryption key and method are identical to Hollow Knight
- Area names and specific fields will need updates when Silksong releases
- Currently supports hypothetical Silksong save structure
- Maintains backward compatibility with Hollow Knight's save format

## Security

⚠️ **Warning**: This tool modifies save files. Always backup your original saves before editing!
