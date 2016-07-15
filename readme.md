# PostCSS SVGIcon

## Colour and access SVG files easily in css.

This PostCSS plugin does three things:

* Lets you define a directory of svgs as your icons folder.
* Lets you easily access and color these svgs in your css.
* Saves the icons as data-uris in your stylesheet as efficiently as possible, with only one uri per icon-colour combo.

It's a simple but effective icon system which required minimal config and maintenance, while allowing easy customization and excellent performance.

### Postcss options

* **path**: Path to a directory containing your svg files.
* **prefix**: *(optional)* If your icon files share a common prefix, you can register it here. This allows you to reference your icons without the prefix. For example, *icon_tick.svg* can be referenced in your css simply as *tick*.

#### Example config

```js
require('postcss-svgicon')({
    path: '/path/to/icon/dir',
    prefix: 'icon_',
})
```

### CSS helper function

In your css, you can now include and colour any icon form the registered directory using the ```svgicon(iconName, iconColour)``` function. *iconName* is simply the name of the svg file you wish to use, without the (optionally configured) prefix or the extension.

#### Example

```css
.my-icon {
	background-image: svgicon(tick, green);
	background-repeat: no-repeat;
}
```
