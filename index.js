'use strict';

// ==== Dependencies ============================================

const path = require('path'),
	fs = require('fs'),
	_ = require('lodash'),
	postcss = require('postcss'),
	traverse = require('traverse'),
	pd = require('pretty-data').pd,
	removeNewline = require('newline-remove'),

	// XML-to-JSON Converters
	xml2jsModule = require('xml2js'),
	xml2js = xml2jsModule.parseString,
	js2xml = new xml2jsModule.Builder(),


// ==== CONSTANTS ============================================

	DEFAULT_OPTIONS = {
		path: './svgs',
		prefix: '',
		functionName: 'svgicon',
		stripStyles: false
	},

	CONFIG = {
		PATH_TYPES: ['path', 'polygon']
	};

// ==== Icon Cache ============================================

class IconCache {
	constructor() {
		this.cache = {};
	}

	add(name, color, code, selector, media) {
		const key = name + color + media;
		this.cache[key] = this.cache[key] || {};
		this.cache[key].instances = this.cache[key].instances || [];
		this.cache[key].code = code;
		this.cache[key].instances = this.cache[key].instances.concat(selector.split(','));
		this.cache[key].media = media;
	}

	has(name, color, media) {
		return _.includes(this.cache, name + color + media);
	}
}

// ==== Helper functions ============================================

/**
 * Find and return what media rule this declaration is within.
 *
 * @param {object} decl The postcss declaration.
 * @returns {string} The media rule, or '__NOMEDIA__' if there is no media rule.
 */
function getMediaRule(decl) {
	let thisDec = decl,
		mediaRule = '__NOMEDIA__';

	// Detect if we're in a media query by traversing ancestors in the tree
	while(thisDec.parent) {
		thisDec = thisDec.parent;

		if (thisDec.type === 'atrule' && thisDec.name === 'media') {
			mediaRule = thisDec.params;
		}
	}

	return mediaRule;
}

/**
 * Extract the name and color options from the svgicon css function.
 * @param {object} decl The postcss declaration.
 * @returns {object} An object containing {name, color}
 */
function getDelcOptions(decl) {
	const aParams = decl.value
		.match(/\((.*)\)/)[1]
		.replace(' ', '')
		.split(',');

	return {
		name: aParams[0],
		color: aParams[1]
	}
}

/**
 * Add icons rules to the end of the styleguide, for all icons
 * without a media query,
 *
 * @param {postcss css object} css
 * @param {IconCache} iconCache
 */
function injectIconRulesWithoutMedia(css, iconCache) {
	for (let key in iconCache.cache) {
		let icon = iconCache.cache[key],
			rule;

		if (icon.media !== '__NOMEDIA__') { continue; }

		rule = postcss.rule({
			selector: icon.instances.join(', ')
		});

		rule.append(postcss.decl({
			prop: 'background-image',
			value: icon.code
		}));

		css.append(rule);
	};
}

/**
 * Add icons rules to the end of the styleguide, for all icons
 * with a media query.
 *
 * @param {postcss css object} css
 * @param {IconCache} iconCache
 */
function injectIconRulesWithMedia(css, iconCache) {
	for (let key in iconCache.cache) {
		let icon = iconCache.cache[key],
			atRule,
			rule;

		if (icon.media === '__NOMEDIA__') { continue; }

		atRule = postcss.atRule({
			name: 'media',
			params: icon.media
		});

		rule = postcss.rule({
			selector: icon.instances.join(', ')
		});

		rule.append(postcss.decl({
			prop: 'background-image',
			value: icon.code
		}));

		css.append(atRule);
		atRule.append(rule);
	}
}

// ==== Plugin ============================================

module.exports = postcss.plugin('postcss-svgicon', function(options) {
	// Override default options
	options = Object.assign({}, DEFAULT_OPTIONS, options);

	return function(css) {
		let sourceDir = path.resolve(options.path),
			iconCache = new IconCache();

		css.walkDecls(function (decl) {
			let icon,
				filepath,
				xml,
				parent = decl.parent;

			// Only consider rules which contain the options.functionName
			if (decl.value.includes(options.functionName) === false) { return; }

			icon = getDelcOptions(decl);
			icon.media = getMediaRule(decl);

			if (iconCache.has(icon.name, icon.color, icon.media)) { return; }


			filepath = `${sourceDir}/${options.prefix}${icon.name}.svg`;
			xml = fs.readFileSync(filepath, 'utf8').toString();

			xml2js(xml, function(err, parsedData) {
				let newSvg,
					newProperty;

				// If a color has been provided, color the fill.
				// If not, just pass the default colors.
				if (typeof icon.color === 'string') {
					traverse(parsedData).forEach(function (value) {
						if (CONFIG.PATH_TYPES.indexOf(this.key) !== -1) {
							let newValue = value,
								len = newValue.length;

							for (let i = 0; i < len; i++) {
								newValue[i]['$'].fill = icon.color;
							}

							this.update(newValue);
						}
					});
				}

				// Convert js back to svg
				newSvg = js2xml.buildObject(parsedData);

				// Clean up svg code
				newSvg = pd.xmlmin(newSvg);
				newSvg = removeNewline(newSvg);

				if (options.stripStyles) {
					// Remove style tage in svg code.
					newSvg = newSvg.replace(/\<style.*style\>/, '');
				}

				newProperty = `url('data:image/svg+xml;charset=utf-8,${newSvg}')`;

				iconCache.add(
					icon.name,
					icon.color,
					newProperty,
					decl.parent.selector,
					icon.media
				);

				decl.remove();

				// If the selector ends up empty, remove it.
				if (parent.nodes.length === 0) {
					parent.remove();
				}
			});

		});

		injectIconRulesWithoutMedia(css, iconCache);
		injectIconRulesWithMedia(css, iconCache);
	};
});
