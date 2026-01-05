/** @type {import('@commitlint/types').UserConfig} */
export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		// Enforce conventional commit types
		'type-enum': [
			2,
			'always',
			['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']
		],
		// Require lowercase type
		'type-case': [2, 'always', 'lower-case'],
		// Subject must not be empty
		'subject-empty': [2, 'never'],
		// Subject max length
		'subject-max-length': [2, 'always', 100]
	},
	helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint'
};
