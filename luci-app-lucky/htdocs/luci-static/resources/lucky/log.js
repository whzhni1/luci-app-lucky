// /www/luci-static/resources/lucky/log.js
'use strict';
'require baseclass';

return baseclass.extend({
    _map: [
        // init / check
        ['Check:',                          _('Check:')],
        ['checking',                        _('Checking...')],
        ['Fetching GitHub API:',            _('Fetching GitHub API:')],
        ['GitHub API failed',               _('GitHub API request failed')],
        ['invalid response',                _('Invalid API response')],
        ['Fetching mirror index:',          _('Fetching mirror index:')],
        ['Failed to fetch mirror index',    _('Failed to fetch mirror index')],
        ['Empty mirror index',              _('Mirror index is empty')],
        ['Tags:',                           _('Available tags:')],
        ['No matching version tags',        _('No matching version tags found')],
        ['Fetching version index:',         _('Fetching version index:')],
        ['Empty index',                     _('Version index is empty')],
        ['No subdir for variant',           _('No matching subdir for selected variant')],
        ['Failed',                          _('Request failed')],
        ['Empty subdir listing',            _('Subdir listing is empty')],
        ['No files in',                     _('No matching files found')],
        ['Found tag:',                      _('Found tag:')],
        ['Extracted:',                      _('Extracted lines:')],
        ['All tags found:',                 _('All tags found:')],
        ['Tags to process:',                _('Tags to process:')],
        ['Processing tag:',                 _('Processing tag:')],
        ['Available subdirs:',              _('Available subdirs:')],
        ['Selected subdir:',                _('Selected subdir:')],
        ['Files found:',                    _('Files found:')],
        ['Found releases:',                 _('Releases found:')],
        ['No lucky releases found',         _('No Lucky releases found')],
        ['No luci releases found',          _('No Luci releases found')],
        ['Unknown mirror:',                 _('Unknown mirror source:')],

        // luci check
        ['Check luci:',                     _('Checking LuCI update:')],
        ['Trying luci API:',                _('Trying LuCI API:')],
        ['Got response from:',              _('Got response from:')],
        ['No response from',                _('No response from API')],
        ['All luci APIs failed',            _('All LuCI API endpoints failed')],
        ['No package manager found',        _('No package manager found')],
        ['Luci:',                           _('LuCI:')],

        // download
        ['Downloading:',                    _('Downloading:')],
        ['From:',                           _('From:')],
        ['Download failed:',                _('Download failed:')],
        ['Downloaded file empty',           _('Downloaded file is empty')],
        ['Download complete:',              _('Download complete:')],
        ['URL not found for',               _('Download URL not found')],

        // install lucky
        ['Extracting...',                   _('Extracting archive...')],
        ['Extract failed:',                 _('Failed to extract archive:')],
        ['Unsupported format:',             _('Unsupported archive format:')],
        ['Binary \'lucky\' not found',      _('Binary "lucky" not found in archive')],
        ['Found binary:',                   _('Found binary:')],
        ['Stopping service...',             _('Stopping Lucky service...')],
        ['Installing:',                     _('Installing:')],
        ['Failed to install',               _('Failed to install binary')],
        ['Starting service...',             _('Starting Lucky service...')],
        ['Installation complete:',          _('Installation complete:')],

        // install luci
        ['Installing luci package...',      _('Installing LuCI package...')],
        ['Install failed',                  _('LuCI package installation failed')],
        ['Detected language:',              _('Detected language:')],
        ['looking for i18n package:',       _('Looking for language pack:')],
        ['Installing language pack:',       _('Installing language pack:')],
        ['Language pack installed:',        _('Language pack installed:')],
        ['Language pack installation failed',  _('Language pack installation failed')],
        ['Luci installed:',                 _('LuCI installed:')],

        // auto update
        ['Auto update:',                    _('Auto update:')],
        ['Auto update complete',            _('Auto update complete')],
        ['Current lucky:',                  _('Current Lucky version:')],
        ['Lucky binary not found, auto download', _('Lucky binary not found, auto download')],
        ['No releases file after check',    _('No releases file after check')],
        ['Cannot parse latest tag',         _('Cannot parse latest tag')],
        ['Cannot parse best file',          _('Cannot parse best file')],
        ['up to date',                      _('Already up to date, skipping')],
        ['skipping',                        _('Skipping update')],
        ['No package manager, skip luci',   _('No package manager, skipping LuCI update')],
        ['No luci releases',                _('No LuCI releases available')],
        ['Luci current:',                   _('Current LuCI version:')],
        ['Latest:',                         _('Latest:')],
        ['forcing download',                _('Forcing download...')],

        // generic
        ['ERROR:',                          _('Error:')],
        ['WARN:',                           _('Warning:')],
        ['error',                           _('Error')],
        ['done',                            _('Done')],
        ['ready',                           _('Ready')],
        ['Waiting',                         _('Waiting')],
        ['complete',                        _('Complete')]
    ],

    _translateLine: function(line) {
        var out = line;
        for (var i = 0; i < this._map.length; i++) {
            var kw = this._map[i][0], tr = this._map[i][1];
            if (out.indexOf(kw) !== -1) {
                out = out.replace(kw, tr);
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