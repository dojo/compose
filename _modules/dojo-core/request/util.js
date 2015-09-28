(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../UrlSearchParams'], function (require, exports) {
    var UrlSearchParams_1 = require('../UrlSearchParams');
    /**
     * Returns a URL formatted with optional query string and cache-busting segments.
     *
     * @param url The base URL.
     * @param options The options hash that is used to generate the query string.
     */
    function generateRequestUrl(url, options) {
        var query = new UrlSearchParams_1.default(options.query).toString();
        if (options.cacheBust) {
            var cacheBust = String(Date.now());
            query += query ? '&' + cacheBust : cacheBust;
        }
        var separator = url.indexOf('?') > -1 ? '&' : '?';
        return query ? url + separator + query : url;
    }
    exports.generateRequestUrl = generateRequestUrl;
});
//# sourceMappingURL=../_debug/request/util.js.map