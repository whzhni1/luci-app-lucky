// /www/luci-static/resources/lucky/log.js
'use strict';
'require baseclass';

return baseclass.extend({
    _map: [
        // init / check 
        ['Check: mirror=',                          _('Check: mirror=')],
        ['Auto update: mirror=',                    _('Auto update: mirror=')],
        ['Found releases:',                         _('Found releases:')],
        ['Luci releases found:',                    _('LuCI releases found:')],
        ['Trying luci API:',                        _('Trying LuCI API:')],
        ['Got response from:',                      _('Got response from:')],
        ['WARN: No response from',                  _('WARN: No response from')],
        ['ERROR: All luci APIs failed',             _('ERROR: All LuCI APIs failed')],
        ['Current lucky:',                          _('Current lucky version:')],
        ['Lucky binary not found, auto download',   _('Lucky binary not found, downloading automatically')],
        ['No package manager, skip luci',           _('No package manager found, skipping LuCI')],
        ['WARN: No luci releases',                  _('WARN: No LuCI releases found')],
        ['Luci current:',                           _('LuCI current version:')],
        ['Latest:',                                 _('Latest version:')],
        ['Auto update complete',                    _('Auto update complete')],

        // download / install
        ['Downloading:',                            _('Downloading:')],
        ['URL:',                                    _('Download URL:')],
        ['Total size: unknown',                     _('Total size: unknown')],
        ['Total size:',                             _('Total size:')],
        ['PROGRESS:',                               _('Progress:')],
        ['Download complete:',                      _('Download complete:')],
        ['Extracting...',                           _('Extracting archive...')],
        ['Found binary:',                           _('Found binary:')],
        ['Stopping service...',                     _('Stopping service...')],
        ['Installing:',                             _('Installing to:')],
        ['Starting service...',                     _('Starting service...')],
        ['Installation complete:',                  _('Installation complete:')],

        // luci package
        ['Installing luci package...',              _('Installing LuCI package...')],
        ['Installing language pack:',               _('Installing language pack:')],
        ['Language pack installed:',                _('Language pack installed:')],
        ['Language pack installation failed',       _('Language pack installation failed')],
        ['Luci installed:',                         _('LuCI installed:')],

        // mirror warnings
        ['WARN: Failed',                            _('WARN: Failed to fetch')],
        ['WARN: Empty index',                       _('WARN: Empty index for tag')],
        ['WARN: No subdir for',                     _('WARN: No subdir for')],
        ['WARN: Empty subdir listing',              _('WARN: Empty subdirectory listing')],
        ['WARN: No files in',                       _('WARN: No files found in')],

        // version up-to-date
        ['Lucky up to date',                        _('Lucky is up to date')],
        ['Luci up to date',                         _('LuCI is up to date')],

        // errors
        ['ERROR: GitHub API failed or invalid response', _('ERROR: GitHub API failed or invalid response')],
        ['ERROR: No matching version tags',         _('ERROR: No matching version tags found')],
        ["ERROR: Binary 'lucky' not found in archive", _("ERROR: Binary 'lucky' not found in archive")],
        ['ERROR: Extract failed:',                  _('ERROR: Extract failed:')],
        ['ERROR: Unsupported format:',              _('ERROR: Unsupported format:')],
        ['ERROR: Failed to install',                _('ERROR: Failed to install')],
        ['ERROR: Download failed:',                 _('ERROR: Download failed:')],
        ['ERROR: Downloaded file empty',            _('ERROR: Downloaded file is empty')],
        ['ERROR: No lucky releases found',          _('ERROR: No lucky releases found')],
        ['ERROR: No luci releases found',           _('ERROR: No LuCI releases found')],
        ['ERROR: No package manager found',         _('ERROR: No package manager found')],
        ['ERROR: Unknown mirror:',                  _('ERROR: Unknown mirror:')],
        ['ERROR: URL not found for',                _('ERROR: Download URL not found for')],
        ['ERROR: Install failed',                   _('ERROR: LuCI package install failed')],
        ['ERROR: No releases file after check',     _('ERROR: No releases file after check')],
        ['ERROR: Cannot parse latest tag',          _('ERROR: Cannot parse latest tag')],
        ['ERROR: Cannot parse best file',           _('ERROR: Cannot parse best file')],
    ],

    _translateLine: function(line) {
        var out = line;
        for (var i = 0; i < this._map.length; i++) {
            var kw = this._map[i][0], tr = this._map[i][1];
            if (out.indexOf(kw) !== -1) {
                out = out.replace(kw, tr);
                break;
            }
        }
        return out;
    },

    translate: function(text) {
        if (!text) return '';
        var self = this;
        return text.split('\n').map(function(line) {
            return self._translateLine(line);
        }).join('\n');
    }
});