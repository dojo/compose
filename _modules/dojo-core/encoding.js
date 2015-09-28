(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", './string'], function (require, exports) {
    var string_1 = require('./string');
    var BASE64_KEYSTR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    function decodeUtf8EncodedCodePoint(codePoint, validationRange, checkSurrogate) {
        if (validationRange === void 0) { validationRange = [0, Infinity]; }
        if (codePoint < validationRange[0] || codePoint > validationRange[1]) {
            throw Error('Invalid continuation byte');
        }
        if (checkSurrogate && codePoint >= string_1.HIGH_SURROGATE_MIN && codePoint <= string_1.LOW_SURROGATE_MAX) {
            throw Error('Surrogate is not a scalar value');
        }
        var encoded = '';
        if (codePoint > 0xFFFF) {
            codePoint -= 0x010000;
            encoded += String.fromCharCode(codePoint >>> 0x10 & 0x03FF | string_1.HIGH_SURROGATE_MIN);
            codePoint = string_1.LOW_SURROGATE_MIN | codePoint & 0x03FF;
        }
        encoded += String.fromCharCode(codePoint);
        return encoded;
    }
    function validateUtf8EncodedCodePoint(codePoint) {
        if ((codePoint & 0xC0) !== 0x80) {
            throw Error('Invalid continuation byte');
        }
    }
    /**
     * Provides facilities for encoding a string into an ASCII-encoded byte buffer and
     * decoding an ASCII-encoded byte buffer into a string.
     */
    exports.ascii = {
        /**
         * Encodes a string into an ASCII-encoded byte buffer.
         *
         * @param data The text string to encode
         */
        encode: function (data) {
            if (data == null) {
                return [];
            }
            var buffer = [];
            for (var i = 0, length_1 = data.length; i < length_1; i++) {
                buffer[i] = data.charCodeAt(i);
            }
            return buffer;
        },
        /**
         * Decodes an ASCII-encoded byte buffer into a string.
         *
         * @param data The byte buffer to decode
         */
        decode: function (data) {
            if (data == null) {
                return '';
            }
            var decoded = '';
            for (var i = 0, length_2 = data.length; i < length_2; i++) {
                decoded += String.fromCharCode(data[i]);
            }
            return decoded;
        }
    };
    /**
     * Provides facilities for encoding a string into a Base64-encoded byte buffer and
     * decoding a Base64-encoded byte buffer into a string.
     */
    exports.base64 = {
        /**
         * Encodes a Base64-encoded string into a Base64 byte buffer.
         *
         * @param data The Base64-encoded string to encode
         */
        encode: function (data) {
            if (data == null) {
                return [];
            }
            var buffer = [];
            var i = 0;
            var length = data.length;
            while (data[--length] === '=') { }
            while (i < length) {
                var encoded = BASE64_KEYSTR.indexOf(data[i++]) << 18;
                if (i <= length) {
                    encoded |= BASE64_KEYSTR.indexOf(data[i++]) << 12;
                }
                if (i <= length) {
                    encoded |= BASE64_KEYSTR.indexOf(data[i++]) << 6;
                }
                if (i <= length) {
                    encoded |= BASE64_KEYSTR.indexOf(data[i++]);
                }
                buffer.push((encoded >>> 16) & 0xff);
                buffer.push((encoded >>> 8) & 0xff);
                buffer.push(encoded & 0xff);
            }
            while (buffer[buffer.length - 1] === 0) {
                buffer.pop();
            }
            return buffer;
        },
        /**
         * Decodes a Base64-encoded byte buffer into a Base64-encoded string.
         *
         * @param data The byte buffer to decode
         */
        decode: function (data) {
            if (data == null) {
                return '';
            }
            var decoded = '';
            var i = 0;
            for (var length_3 = data.length - (data.length % 3); i < length_3;) {
                var encoded = data[i++] << 16 | data[i++] << 8 | data[i++];
                decoded += BASE64_KEYSTR.charAt((encoded >>> 18) & 0x3F);
                decoded += BASE64_KEYSTR.charAt((encoded >>> 12) & 0x3F);
                decoded += BASE64_KEYSTR.charAt((encoded >>> 6) & 0x3F);
                decoded += BASE64_KEYSTR.charAt(encoded & 0x3F);
            }
            if (data.length % 3 === 1) {
                var encoded = data[i++] << 16;
                decoded += BASE64_KEYSTR.charAt((encoded >>> 18) & 0x3f);
                decoded += BASE64_KEYSTR.charAt((encoded >>> 12) & 0x3f);
                decoded += '==';
            }
            else if (data.length % 3 === 2) {
                var encoded = data[i++] << 16 | data[i++] << 8;
                decoded += BASE64_KEYSTR.charAt((encoded >>> 18) & 0x3f);
                decoded += BASE64_KEYSTR.charAt((encoded >>> 12) & 0x3f);
                decoded += BASE64_KEYSTR.charAt((encoded >>> 6) & 0x3f);
                decoded += '=';
            }
            return decoded;
        }
    };
    /**
     * Provides facilities for encoding a string into a hex-encoded byte buffer and
     * decoding a hex-encoded byte buffer into a string.
     */
    exports.hex = {
        /**
         * Encodes a string into a hex-encoded byte buffer.
         *
         * @param data The hex-encoded string to encode
         */
        encode: function (data) {
            if (data == null) {
                return [];
            }
            var buffer = [];
            for (var i = 0, length_4 = data.length; i < length_4; i += 2) {
                var encodedChar = parseInt(data.substr(i, 2), 16);
                buffer.push(encodedChar);
            }
            return buffer;
        },
        /**
         * Decodes a hex-encoded byte buffer into a hex-encoded string.
         *
         * @param data The byte buffer to decode
         */
        decode: function (data) {
            if (data == null) {
                return '';
            }
            var decoded = '';
            for (var i = 0, length_5 = data.length; i < length_5; i++) {
                decoded += data[i].toString(16).toUpperCase();
            }
            return decoded;
        }
    };
    /**
     * Provides facilities for encoding a string into a UTF-8-encoded byte buffer and
     * decoding a UTF-8-encoded byte buffer into a string.
     * Inspired by the work of: https://github.com/mathiasbynens/utf8.js
     */
    exports.utf8 = {
        /**
         * Encodes a string into a UTF-8-encoded byte buffer.
         *
         * @param data The text string to encode
         */
        encode: function (data) {
            if (data == null) {
                return [];
            }
            var buffer = [];
            for (var i = 0, length_6 = data.length; i < length_6; i++) {
                var encodedChar = data.charCodeAt(i);
                /**
                 * Surrogates
                 * http://en.wikipedia.org/wiki/Universal_Character_Set_characters
                 */
                if (encodedChar >= string_1.HIGH_SURROGATE_MIN && encodedChar <= string_1.HIGH_SURROGATE_MAX) {
                    var lowSurrogate = data.charCodeAt(i + 1);
                    if (lowSurrogate >= string_1.LOW_SURROGATE_MIN && lowSurrogate <= string_1.LOW_SURROGATE_MAX) {
                        encodedChar = 0x010000 + (encodedChar - string_1.HIGH_SURROGATE_MIN) * 0x0400 + (lowSurrogate - string_1.LOW_SURROGATE_MIN);
                        i++;
                    }
                }
                if (encodedChar < 0x80) {
                    buffer.push(encodedChar);
                }
                else {
                    if (encodedChar < 0x800) {
                        buffer.push(((encodedChar >> 0x06) & 0x1F) | 0xC0);
                    }
                    else if (encodedChar < 0x010000) {
                        if (encodedChar >= string_1.HIGH_SURROGATE_MIN && encodedChar <= string_1.LOW_SURROGATE_MAX) {
                            throw Error('Surrogate is not a scalar value');
                        }
                        buffer.push(((encodedChar >> 0x0C) & 0x0F) | 0xE0);
                        buffer.push(((encodedChar >> 0x06) & 0x3F) | 0x80);
                    }
                    else if (encodedChar < 0x200000) {
                        buffer.push(((encodedChar >> 0x12) & 0x07) | 0xF0);
                        buffer.push(((encodedChar >> 0x0C) & 0x3F) | 0x80);
                        buffer.push(((encodedChar >> 0x06) & 0x3F) | 0x80);
                    }
                    buffer.push((encodedChar & 0x3F) | 0x80);
                }
            }
            return buffer;
        },
        /**
         * Decodes a UTF-8-encoded byte buffer into a string.
         *
         * @param data The byte buffer to decode
         */
        decode: function (data) {
            if (data == null) {
                return '';
            }
            var decoded = '';
            for (var i = 0, length_7 = data.length; i < length_7; i++) {
                var byte1 = data[i] & 0xFF;
                if ((byte1 & 0x80) === 0) {
                    decoded += decodeUtf8EncodedCodePoint(byte1);
                }
                else if ((byte1 & 0xE0) === 0xC0) {
                    var byte2 = data[++i] & 0xFF;
                    validateUtf8EncodedCodePoint(byte2);
                    byte2 = byte2 & 0x3F;
                    var encodedByte = ((byte1 & 0x1F) << 0x06) | byte2;
                    decoded += decodeUtf8EncodedCodePoint(encodedByte, [0x80, Infinity]);
                }
                else if ((byte1 & 0xF0) === 0xE0) {
                    var byte2 = data[++i] & 0xFF;
                    validateUtf8EncodedCodePoint(byte2);
                    byte2 = byte2 & 0x3F;
                    var byte3 = data[++i] & 0xFF;
                    validateUtf8EncodedCodePoint(byte3);
                    byte3 = byte3 & 0x3F;
                    var encodedByte = ((byte1 & 0x1F) << 0x0C) | (byte2 << 0x06) | byte3;
                    decoded += decodeUtf8EncodedCodePoint(encodedByte, [0x0800, Infinity], true);
                }
                else if ((byte1 & 0xF8) === 0xF0) {
                    var byte2 = data[++i] & 0xFF;
                    validateUtf8EncodedCodePoint(byte2);
                    byte2 = byte2 & 0x3F;
                    var byte3 = data[++i] & 0xFF;
                    validateUtf8EncodedCodePoint(byte3);
                    byte3 = byte3 & 0x3F;
                    var byte4 = data[++i] & 0xFF;
                    validateUtf8EncodedCodePoint(byte4);
                    byte4 = byte4 & 0x3F;
                    var encodedByte = ((byte1 & 0x1F) << 0x0C) | (byte2 << 0x0C) | (byte3 << 0x06) | byte4;
                    decoded += decodeUtf8EncodedCodePoint(encodedByte, [0x010000, 0x10FFFF]);
                }
                else {
                    validateUtf8EncodedCodePoint(byte1);
                }
            }
            return decoded;
        }
    };
});
//# sourceMappingURL=_debug/encoding.js.map