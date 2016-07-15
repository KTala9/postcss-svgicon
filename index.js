var path = require('path');
var fs = require('fs');
var util = require('util');

var _ = require('lodash');

var postcss = require('postcss');

var xml2jsModule = require('xml2js');
var traverse = require('traverse');
var pd = require('pretty-data').pd;
var removeNewline = require('newline-remove');
var strictUriEncode = require('strict-uri-encode');
var base64 = require('base-64');


var xml2js = xml2jsModule.parseString;
var js2xml = new xml2jsModule.Builder();

module.exports = postcss.plugin('postcss-svgicon', function(options) {

	options = options || {};

	var funcName = 'svgicon';

	// Regex for extracting the svg
	var svgRegex = new RegExp('svgicon\\([\"|\'](.*)[\"|\']\\)');

	return function(css, result) {
		
		var sourceDir = path.resolve(options.path);

		var iconCache = {};

		function saveIconToCache(name, color, code, selector) {
			iconCache[name + color] = iconCache[name + color] || {};
			iconCache[name + color].instances = iconCache[name + color].instances || [];

			iconCache[name + color].code = code;
			iconCache[name + color].instances.push(selector);
		}

		function isIconAlreadyCached(name, color) {
			return _.includes(iconCache, name + color);
		}

		css.walkDecls(function (decl) {
			if (decl.value.indexOf(funcName) === -1) {
				return;
			}

			var delcOptions = decl.value
								.match(/\((.*)\)/)[1]
								.replace(' ', '')
								.split(',');

			var iconName = delcOptions[0];
			var iconColor = delcOptions[1];

			if (isIconAlreadyCached(iconName, iconColor)) {
				return;
			}

			var filepath = sourceDir + '/' + options.prefix + iconName + '.svg';

			var xml = fs.readFileSync(filepath, 'utf8').toString();
			var newSvg;
			var newProperty;

			xml2js(xml, function(err, parsedData) {
				traverse(parsedData).forEach(function (value) {
					if (this.key === 'path') {
						var newValue = value;

						newValue[0]['$'].fill = iconColor;

						this.update(newValue);

						// if (newValue[0]['$'].class) {
						// 	console.log(newValue[0]['$'].class);
						// }
					}
				});

				//console.log(util.inspect(parsedData, {showHidden: false, depth: null}));

				newSvg = js2xml.buildObject(parsedData);
				newSvg = pd.xmlmin(newSvg);
				newSvg = removeNewline(newSvg);
				newSvg = newSvg.replace(/\<style.*style\>/, '');

				//newSvg = strictUriEncode(newSvg);
				newProperty = 'url(\'data:image/svg+xml,' + newSvg + '\')';
				
				// newSvg = base64.encode(newSvg);
				// newProperty = 'url("data:image/svg+xml;base64,' + newSvg + '")';
		
				//decl.value = newProperty;

				saveIconToCache(iconName, iconColor, newProperty, decl.parent.selector);

				decl.remove();
			});
		});

		_.forEach(iconCache, function(icon) {
			var rule = postcss.rule({
				selector: icon.instances.join(', ')
			});

			rule.append(postcss.decl({
				prop: 'background-image',
				value: icon.code
			}));

			css.append(rule);
		}); 
	}
 
});