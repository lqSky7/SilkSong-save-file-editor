const SILKSONG_BASE64_ARRAY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".split("").map(c => c.charCodeAt(0));
const SILKSONG_BASE64_ENCODE_TABLE = new Map(SILKSONG_BASE64_ARRAY.map((ord, i) => [i, ord]));
const SILKSONG_BASE64_DECODE_TABLE = new Map(SILKSONG_BASE64_ARRAY.map((ord, i) => [ord, i]));

function silksongBase64Encode(buffer) {
    buffer = new Uint8Array(buffer).slice();
    var output = new Uint8Array(Math.ceil(Math.ceil(buffer.length * 4 / 3) / 4) * 4);
    let continuous = Math.floor(buffer.length / 3) * 3;

    for (let i = 0; i < continuous; i += 3) {
        let k = 4 * i / 3;
        output[k] = SILKSONG_BASE64_ENCODE_TABLE.get(buffer[i] >> 2);
        output[k + 1] = SILKSONG_BASE64_ENCODE_TABLE.get((buffer[i] & 0x03) << 4 | buffer[i + 1] >> 4);
        output[k + 2] = SILKSONG_BASE64_ENCODE_TABLE.get((buffer[i + 1] & 0x0F) << 2 | buffer[i + 2] >> 6);
        output[k + 3] = SILKSONG_BASE64_ENCODE_TABLE.get(buffer[i + 2] & 0x3F);
    }

    if (buffer[continuous] != undefined) {
        let k = 4 * continuous / 3;
        output[k] = SILKSONG_BASE64_ENCODE_TABLE.get(buffer[continuous] >> 2);
        if (buffer[continuous + 1] == undefined) {
            output[k + 1] = SILKSONG_BASE64_ENCODE_TABLE.get((buffer[continuous] & 0x03) << 4);
            output[k + 2] = SILKSONG_BASE64_ENCODE_TABLE.get(64);
        } else {
            output[k + 1] = SILKSONG_BASE64_ENCODE_TABLE.get((buffer[continuous] & 0x03) << 4 | buffer[continuous + 1] >> 4);
            output[k + 2] = SILKSONG_BASE64_ENCODE_TABLE.get((buffer[continuous + 1] & 0x0F) << 2);
        }
        output[k + 3] = SILKSONG_BASE64_ENCODE_TABLE.get(64);
    }

    return output;
}

function silksongBase64Decode(buffer) {
    buffer = new Uint8Array(buffer).slice();
    buffer = buffer.map(v => SILKSONG_BASE64_DECODE_TABLE.get(v));
    let p = buffer.indexOf(64);
    buffer = buffer.subarray(0, p != -1 ? p : buffer.length);
    var output = new Uint8Array(3 * buffer.length / 4);
    let continuous = Math.floor(buffer.length / 4) * 4;
    
    for (let i = 0; i < continuous; i += 4) {
        let k = 3 * i / 4;
        output[k] = buffer[i] << 2 | buffer[i + 1] >> 4;
        output[k + 1] = (buffer[i + 1] & 0x0F) << 4 | buffer[i + 2] >> 2;
        output[k + 2] = (buffer[i + 2] & 0x03) << 6 | buffer[i + 3];
    }
    
    if (buffer[continuous] != undefined) {
        let k = 3 * continuous / 4;
        output[k] = buffer[continuous] << 2 | buffer[continuous + 1] >> 4;
        if (buffer[continuous + 2] != undefined) {
            output[k + 1] = (buffer[continuous + 1] & 0x0F) << 4 | buffer[continuous + 2] >> 2;
        }
    }
    
    return output;
}

// ============================================================================
// SAVE FILE PROCESSING FUNCTIONS
// ============================================================================

const SILKSONG_CSHARP_HEADER = [0, 1, 0, 0, 0, 255, 255, 255, 255, 1, 0, 0, 0, 0, 0, 0, 0, 6, 1, 0, 0, 0];
const SILKSONG_AES_KEY = silksongStringToBytes('UKu52ePUBwetZ9wNX88o54dnfKRu0T1l');

// Initialize AES ECB mode (assuming aesjs is loaded)
let silksongECB;
if (typeof aesjs !== 'undefined') {
    silksongECB = new aesjs.ModeOfOperation.ecb(SILKSONG_AES_KEY);
}

// String utility extension
String.prototype.silksongReverse = function() {
    return this.split("").reverse().join("");
};

function silksongStringToBytes(string) {
    return new TextEncoder().encode(string);
}

function silksongBytesToString(bytes) {
    return new TextDecoder().decode(bytes);
}

// AES decrypts and removes PKCS7 padding 
function silksongAESDecrypt(bytes) {
    let data = silksongECB.decrypt(bytes);
    data = data.subarray(0, -data[data.length - 1]);
    return data;
}

// PKCS7 pads and encrypts 
function silksongAESEncrypt(bytes) {
    let padValue = 16 - bytes.length % 16;
    var padded = new Uint8Array(bytes.length + padValue);
    padded.fill(padValue);
    padded.set(bytes);
    return silksongECB.encrypt(padded);
}

// LengthPrefixedString https://msdn.microsoft.com/en-us/library/cc236844.aspx
function silksongGenerateLengthPrefixedString(length) {
    var length = Math.min(0x7FFFFFFF, length); // maximum value
    var bytes = [];
    
    for (let i = 0; i < 4; i++) {
        if (length >> 7 != 0) {
            bytes.push(length & 0x7F | 0x80);
            length >>= 7;
        } else {
            bytes.push(length & 0x7F);
            length >>= 7;
            break;
        }
    }
    
    if (length != 0) {
        bytes.push(length);
    }

    return bytes;
}

function silksongAddHeader(bytes) {
    var lengthData = silksongGenerateLengthPrefixedString(bytes.length);
    var newBytes = new Uint8Array(bytes.length + SILKSONG_CSHARP_HEADER.length + lengthData.length + 1);
    newBytes.set(SILKSONG_CSHARP_HEADER); // fixed header
    newBytes.subarray(SILKSONG_CSHARP_HEADER.length).set(lengthData); // variable LengthPrefixedString header
    newBytes.subarray(SILKSONG_CSHARP_HEADER.length + lengthData.length).set(bytes); // our data
    newBytes.subarray(SILKSONG_CSHARP_HEADER.length + lengthData.length + bytes.length).set([11]); // fixed header (11)
    return newBytes;
}

function silksongRemoveHeader(bytes) {
    // remove fixed csharp header, plus the ending byte 11.
    bytes = bytes.subarray(SILKSONG_CSHARP_HEADER.length, bytes.length - 1);

    // remove LengthPrefixedString header
    let lengthCount = 0;
    for (let i = 0; i < 5; i++) {
        lengthCount++;
        if ((bytes[i] & 0x80) == 0) {
            break;
        }
    }
    bytes = bytes.subarray(lengthCount);

    return bytes;
}

function silksongDecodeSave(bytes) {
    bytes = bytes.slice();
    bytes = silksongRemoveHeader(bytes);
    bytes = silksongBase64Decode(bytes);
    bytes = silksongAESDecrypt(bytes);
    return silksongBytesToString(bytes);
}

function silksongEncodeSave(jsonString) {
    var bytes = silksongStringToBytes(jsonString);
    bytes = silksongAESEncrypt(bytes);
    bytes = silksongBase64Encode(bytes);
    return silksongAddHeader(bytes);
}

function silksongHash(string) {
    return string.split("").reduce((a, b) => {
        return ((a << 5) - a) + b.charCodeAt(0);
    }, 0);
}

function silksongRound(value, precision) {
    let multi = Math.pow(10, precision);
    return Math.round(value * multi) / multi;
}

function silksongHumanTime(date) {
    var minutes = (new Date() - date) / 1000 / 60;
    var hours = minutes / 60;
    var days = hours / 24;
    var weeks = days / 7;
    var months = weeks / 4;
    var years = months / 12;

    if (minutes < 1) {
        return "now";
    } else if (minutes < 120) {
        return `about ${silksongRound(minutes, 0)} minutes ago`;
    } else if (hours < 48) {
        return `about ${silksongRound(hours, 0)} hours ago`;
    } else if (days < 14) {
        return `about ${silksongRound(days, 0)} days ago`;
    } else if (weeks < 8) {
        return `about ${silksongRound(weeks, 0)} weeks ago`;
    } else if (months < 24) {
        return `about ${silksongRound(months, 1)} months ago`;
    }

    return `about ${silksongRound(years, 1)} years ago`;
}

function silksongDownloadData(data, fileName) {
    var a = document.createElement("a");
    a.setAttribute("href", window.URL.createObjectURL(new Blob([data], { type: "octet/stream" })));
    a.setAttribute('download', fileName);
    a.setAttribute('style', `position: fixed; opacity: 0; left: 0; top: 0;`);
    document.body.append(a);
    a.click();
    document.body.removeChild(a);
}
