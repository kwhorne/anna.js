## Dependencies

Themes are written using Sass to keep things modular and reduce the need for repeated selectors across files. Make sure that you have the anna.js development environment including the Sass dependencies installed before proceding.

## Creating a Theme

To create your own theme, start by duplicating a ```.scss``` file in [/css/theme/source](). Each theme does four things:

1. **Set up the color scheme you want to use**
2. **Import `/css/theme/template/theme.scss`**
3. **Override the default theme variables** ([see all variables](css/theme/template/theme.scss#L33))
4. **Specify custom CSS/overrides**

When you are done, use the grunt file to build the theme:

```
grunt css-themes
```

Or

```
grunt css-themes-[THEME NAME]
