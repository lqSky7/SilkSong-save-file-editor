# Silksong Save File Editor

A web-based save file editor for Hollow Knight: Silksong that runs entirely in the browser.

## Features

- Load and decrypt Silksong save files (.dat format)
- Edit player data (health, geo, silk, abilities)
- Save modified files back to encrypted format
- No server required - runs completely client-side

## Usage

1. Open `public/index.html` in a web browser
2. Upload your save file (typically `user1.dat`)
3. Edit the values as desired
4. Download the modified save file

## Running Locally

Serve the files using any local web server:

```bash
# Using Python
python3 -m http.server 8000 --directory public

# Using Node.js http-server
npx http-server public -p 8000

# Using npm scripts
npm run serve
```

Then open `http://localhost:8000` in your browser.

## Credits

- Title design: [Hollow Knight Title Generator](https://prashantmohta.github.io/TitleGenerator.HollowKnight/?title=0&blur=true&font=1&bold=true&main=SilkSONG&sub=Save%20file%20editor)
- Decryption methodology: [Hollow Knight SaveManager](https://github.com/KayDeeTee/Hollow-Knight-SaveManager)

## License

MIT
