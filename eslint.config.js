import neostandard from 'neostandard'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),
  {
    // Files that use JSON import attributes (`with { type: 'json' }`), which need ecmaVersion 2025+:
    // the fixture files themselves, and any test importing a fixture JSON file directly.
    files: [
      'src/common/schemas/fixtures/**/*.js',
      'src/reference-data/**/*.test.js',
      'src/routes/**/*.test.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest'
    }
  }
]
