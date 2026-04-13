const js = require('@eslint/js');

module.exports = [
	js.configs.recommended,
	{
		files: ['js/anna.js'],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'script',
			globals: {
				window: 'readonly',
				document: 'readonly',
				navigator: 'readonly',
				console: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				requestAnimationFrame: 'readonly',
				HTMLElement: 'readonly',
				location: 'readonly',
				atob: 'readonly',
				define: 'readonly',
				module: 'writable',
				exports: 'writable',
				require: 'readonly',
			}
		},
		rules: {
			'no-unused-vars': ['warn', { args: 'none' }],
			'no-undef': 'error',
			'eqeqeq': 'warn',
			'no-useless-escape': 'off',
			'no-empty': 'warn',
		}
	}
];
