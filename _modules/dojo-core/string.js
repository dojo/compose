(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports"], function (require, exports) {
    var escapeRegExpPattern = /[[\]{}()|\/\\^$.*+?]/g;
    var escapeXmlPattern = /[&<]/g;
    var escapeXmlForPattern = /[&<>'"]/g;
    var escapeXmlMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;'
    };
    exports.HIGH_SURROGATE_MIN = 0xD800;
    exports.HIGH_SURROGATE_MAX = 0xDBFF;
    exports.LOW_SURROGATE_MIN = 0xDC00;
    exports.LOW_SURROGATE_MAX = 0xDFFF;
    /**
     * Performs validation and padding operations used by padStart and padEnd.
     */
    function getPadding(name, text, length, character) {
        if (character === void 0) { character = '0'; }
        if (text == null) {
            throw new TypeError('string.' + name + ' requires a valid string.');
        }
        if (character.length !== 1) {
            throw new TypeError('string.' + name + ' requires a valid padding character.');
        }
        if (length < 0 || length === Infinity) {
            throw new RangeError('string.' + name + ' requires a valid length.');
        }
        length -= text.length;
        return length < 1 ? '' : repeat(character, length);
    }
    /**
     * Validates that text is defined, and normalizes position (based on the given default if the input is NaN).
     * Used by startsWith, includes, and endsWith.
     * @return Normalized position.
     */
    function normalizeSubstringArgs(name, text, search, position, isEnd) {
        if (isEnd === void 0) { isEnd = false; }
        if (text == null) {
            throw new TypeError('string.' + name + ' requires a valid string to search against.');
        }
        var length = text.length;
        position = position !== position ? (isEnd ? length : 0) : position;
        return [text, String(search), Math.min(Math.max(position, 0), length)];
    }
    /**
     * Returns the UTF-16 encoded code point value of a given position in a string.
     * @param text The string containing the element whose code point is to be determined
     * @param position Position of an element within the string to retrieve the code point value from
     * @return A non-negative integer representing the UTF-16 encoded code point value
     */
    function codePointAt(text, position) {
        if (position === void 0) { position = 0; }
        // Adapted from https://github.com/mathiasbynens/String.prototype.codePointAt
        if (text == null) {
            throw new TypeError('string.codePointAt requries a valid string.');
        }
        var length = text.length;
        if (position !== position) {
            position = 0;
        }
        if (position < 0 || position >= length) {
            return undefined;
        }
        // Get the first code unit
        var first = text.charCodeAt(position);
        if (first >= exports.HIGH_SURROGATE_MIN && first <= exports.HIGH_SURROGATE_MAX && length > position + 1) {
            // Start of a surrogate pair (high surrogate and there is a next code unit); check for low surrogate
            // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            var second = text.charCodeAt(position + 1);
            if (second >= exports.LOW_SURROGATE_MIN && second <= exports.LOW_SURROGATE_MAX) {
                return (first - exports.HIGH_SURROGATE_MIN) * 0x400 + second - exports.LOW_SURROGATE_MIN + 0x10000;
            }
        }
        return first;
    }
    exports.codePointAt = codePointAt;
    /**
     * Determines whether a string ends with the given substring.
     * @param text The string to look for the search string within
     * @param search The string to search for
     * @param endPosition The index searching should stop before (defaults to text.length)
     * @return Boolean indicating if the search string was found at the end of the given string
     */
    function endsWith(text, search, endPosition) {
        if (endPosition == null && text != null) {
            endPosition = text.length;
        }
        _a = normalizeSubstringArgs('endsWith', text, search, endPosition, true), text = _a[0], search = _a[1], endPosition = _a[2];
        var start = endPosition - search.length;
        if (start < 0) {
            return false;
        }
        return text.slice(start, endPosition) === search;
        var _a;
    }
    exports.endsWith = endsWith;
    /**
     * Escapes a string so that it can safely be passed to the RegExp constructor.
     * @param text The string to be escaped
     * @return The escaped string
     */
    function escapeRegExp(text) {
        return !text ? text : text.replace(escapeRegExpPattern, '\\$&');
    }
    exports.escapeRegExp = escapeRegExp;
    /**
     * Sanitizes a string to protect against tag injection.
     * @param xml The string to be escaped
     * @param forAttribute Whether to also escape ', ", and > in addition to < and &
     * @return The escaped string
     */
    function escapeXml(xml, forAttribute) {
        if (forAttribute === void 0) { forAttribute = true; }
        if (!xml) {
            return xml;
        }
        var pattern = forAttribute ? escapeXmlForPattern : escapeXmlPattern;
        return xml.replace(pattern, function (character) {
            return escapeXmlMap[character];
        });
    }
    exports.escapeXml = escapeXml;
    /**
     * Returns a string created by using the specified sequence of code points.
     * @param codePoints One or more code points
     * @return A string containing the given code points
     */
    function fromCodePoint() {
        var codePoints = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            codePoints[_i - 0] = arguments[_i];
        }
        // Adapted from https://github.com/mathiasbynens/String.fromCodePoint
        var length = arguments.length;
        if (!length) {
            return '';
        }
        var fromCharCode = String.fromCharCode;
        var MAX_SIZE = 0x4000;
        var codeUnits = [];
        var index = -1;
        var result = '';
        while (++index < length) {
            var codePoint = Number(arguments[index]);
            // Code points must be finite integers within the valid range
            var isValid = isFinite(codePoint) && Math.floor(codePoint) === codePoint &&
                codePoint >= 0 && codePoint <= 0x10FFFF;
            if (!isValid) {
                throw RangeError('string.fromCodePoint: Invalid code point ' + codePoint);
            }
            if (codePoint <= 0xFFFF) {
                // BMP code point
                codeUnits.push(codePoint);
            }
            else {
                // Astral code point; split in surrogate halves
                // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                codePoint -= 0x10000;
                var highSurrogate = (codePoint >> 10) + exports.HIGH_SURROGATE_MIN;
                var lowSurrogate = (codePoint % 0x400) + exports.LOW_SURROGATE_MIN;
                codeUnits.push(highSurrogate, lowSurrogate);
            }
            if (index + 1 === length || codeUnits.length > MAX_SIZE) {
                result += fromCharCode.apply(null, codeUnits);
                codeUnits.length = 0;
            }
        }
        return result;
    }
    exports.fromCodePoint = fromCodePoint;
    /**
     * Determines whether a string includes the given substring (optionally starting from a given index).
     * @param text The string to look for the search string within
     * @param search The string to search for
     * @param position The index to begin searching at
     * @return Boolean indicating if the search string was found within the given string
     */
    function includes(text, search, position) {
        if (position === void 0) { position = 0; }
        _a = normalizeSubstringArgs('includes', text, search, position), text = _a[0], search = _a[1], position = _a[2];
        return text.indexOf(search, position) !== -1;
        var _a;
    }
    exports.includes = includes;
    /**
     * Adds padding to the end of a string to ensure it is a certain length.
     * @param text The string to pad
     * @param length The target minimum length of the string
     * @param character The character to pad onto the end of the string
     * @return The string, padded to the given length if necessary
     */
    function padEnd(text, length, character) {
        if (character === void 0) { character = '0'; }
        return text + getPadding('padEnd', text, length, character);
    }
    exports.padEnd = padEnd;
    /**
     * Adds padding to the beginning of a string to ensure it is a certain length.
     * @param text The string to pad
     * @param length The target minimum length of the string
     * @param character The character to pad onto the beginning of the string
     * @return The string, padded to the given length if necessary
     */
    function padStart(text, length, character) {
        if (character === void 0) { character = '0'; }
        return getPadding('padStart', text, length, character) + text;
    }
    exports.padStart = padStart;
    /**
     * A tag function for template strings to get the template string's raw string form.
     * @param callSite Call site object (or a template string in TypeScript, which will transpile to one)
     * @param substitutions Values to substitute within the template string (TypeScript will generate these automatically)
     * @return String containing the raw template string with variables substituted
     *
     * @example
     * // Within TypeScript; logs 'The answer is:\\n42'
     * let answer = 42;
     * console.log(string.raw`The answer is:\n${answer}`);
     *
     * @example
     * // The same example as above, but directly specifying a JavaScript object and substitution
     * console.log(string.raw({ raw: [ 'The answer is:\\n', '' ] }, 42));
     */
    function raw(callSite) {
        var substitutions = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            substitutions[_i - 1] = arguments[_i];
        }
        var rawStrings = callSite.raw;
        var result = '';
        var numSubstitutions = substitutions.length;
        if (callSite == null || callSite.raw == null) {
            throw new TypeError('string.raw requires a valid callSite object with a raw value');
        }
        for (var i = 0, length_1 = rawStrings.length; i < length_1; i++) {
            result += rawStrings[i] + (i < numSubstitutions && i < length_1 - 1 ? substitutions[i] : '');
        }
        return result;
    }
    exports.raw = raw;
    /**
     * Returns a string containing the given string repeated the specified number of times.
     * @param text The string to repeat
     * @param count The number of times to repeat the string
     * @return A string containing the input string repeated count times
     */
    function repeat(text, count) {
        if (count === void 0) { count = 0; }
        // Adapted from https://github.com/mathiasbynens/String.prototype.repeat
        if (text == null) {
            throw new TypeError('string.repeat requires a valid string.');
        }
        if (count !== count) {
            count = 0;
        }
        if (count < 0 || count === Infinity) {
            throw new RangeError('string.repeat requires a non-negative finite count.');
        }
        var result = '';
        while (count) {
            if (count % 2) {
                result += text;
            }
            if (count > 1) {
                text += text;
            }
            count >>= 1;
        }
        return result;
    }
    exports.repeat = repeat;
    /**
     * Determines whether a string begins with the given substring (optionally starting from a given index).
     * @param text The string to look for the search string within
     * @param search The string to search for
     * @param position The index to begin searching at
     * @return Boolean indicating if the search string was found at the beginning of the given string
     */
    function startsWith(text, search, position) {
        if (position === void 0) { position = 0; }
        search = String(search);
        _a = normalizeSubstringArgs('startsWith', text, search, position), text = _a[0], search = _a[1], position = _a[2];
        var end = position + search.length;
        if (end > text.length) {
            return false;
        }
        return text.slice(position, end) === search;
        var _a;
    }
    exports.startsWith = startsWith;
});
//# sourceMappingURL=_debug/string.js.map